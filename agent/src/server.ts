/**
 * The sidecar process.
 *
 * It holds the Claude Code login and nothing else: the deck stays in the
 * browser, and every tool call is answered by the app over this socket.
 */
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  CLOSE_CODES,
  LIMITS,
  PROTOCOL_VERSION,
  parseClientFrame,
  type ServerFrame,
} from '@/lib/assistant/protocol';
import { AuthService, type AccountIdentity } from './auth';
import { realSdk as sdkForAccount } from './sdk';
import { loadConfig, type AgentConfig } from './config';
import { createHttpHandler, readCookie } from './http';
import { diagnoseLaunch } from './diagnose';
import { createLogger, type Logger } from './log';
import { SessionRegistry } from './registry';
import { newConversationId } from './session';
import { realSdk } from './sdk';
import { SESSION_COOKIE } from './auth';

const run = promisify(execFile);
const VERSION = '1.0.0';

/** Whether the other end of this socket is on this machine. */
function isLoopbackPeer(address: string | undefined): boolean {
  if (!address) return false;
  const host = address.replace(/^::ffff:/, '');
  return host === '127.0.0.1' || host === '::1' || host.startsWith('127.');
}

/**
 * The Claude Code binary that ships with the SDK, so a sign-in started from the
 * app is the same program the agent itself runs.
 */
/**
 * Which platform package this machine can actually run, best first.
 *
 * This used to be a fixed list beginning with linux-x64, which is fine until
 * more than one package is installed: on an arm64 host it hands back an x86-64
 * binary, and the only symptom is "exists but failed to launch". Ask the
 * machine instead. glibcVersionRuntime is absent on musl, which is how a musl
 * host is told apart from a glibc one.
 */
export function platformCandidates(
  proc: { platform: string; arch: string } = process,
  glibc: boolean = Boolean(
    (process.report?.getReport() as { header?: { glibcVersionRuntime?: string } } | undefined)
      ?.header?.glibcVersionRuntime,
  ),
): string[] {
  const arch = proc.arch === 'arm64' ? 'arm64' : 'x64';
  if (proc.platform === 'darwin') return [`darwin-${arch}`];
  const native = glibc ? `linux-${arch}` : `linux-${arch}-musl`;
  const other = glibc ? `linux-${arch}-musl` : `linux-${arch}`;
  // The other libc for this architecture is worth a try; the other
  // architecture is not, and reaching for it is what caused the bug.
  return [native, other];
}

function findClaudeBinary(): string {
  const require = createRequire(import.meta.url);
  for (const platform of platformCandidates()) {
    try {
      const manifest = require.resolve(`@anthropic-ai/claude-agent-sdk-${platform}/package.json`);
      return path.join(path.dirname(manifest), 'claude');
    } catch {
      continue;
    }
  }
  // Falls back to whatever is on the PATH, which is how a system install works.
  return 'claude';
}

/**
 * The directory conversations run in, made sure it is there.
 *
 * A conversation is spawned with this as its working directory, and spawn
 * reports a missing working directory as ENOENT against the command it was
 * given — which the SDK then describes as the Claude Code binary failing to
 * launch, with a mismatched libc as the suggested cause. So every turn fails
 * with a message about the wrong thing entirely. The container creates
 * /data/workspace in the image, which is exactly the directory an operator
 * who bind-mounts /data from the host does not get.
 *
 * Nothing is kept here — the model has no file tools — so where it points
 * matters less than that it exists: a directory that cannot be created is
 * worth a warning and the one this process is already running in, not a
 * sidecar that refuses to answer.
 */
export function ensureWorkspace(dir: string, log: Logger): string {
  try {
    mkdirSync(dir, { recursive: true });
    return dir;
  } catch (error) {
    const fallback = process.cwd();
    log.warn('could not create the workspace; conversations will run in the current directory', {
      dir,
      fallback,
      error: String(error),
    });
    return fallback;
  }
}

function sameToken(expected: string, given: string): boolean {
  // Hash first so the comparison length never leaks the token length.
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(given).digest();
  return timingSafeEqual(a, b);
}

/** Ask the bundled CLI whether it has credentials. Cached: it spawns a process. */
type AuthState = 'ok' | 'needs_login' | 'unknown';

/**
 * Whether Claude Code has usable credentials.
 *
 * Answering costs a subprocess, so the result is cached for a minute and
 * `peek` reads that cache without waiting for anything: the socket handshake
 * must never sit behind a process start, and 'unknown' on a cold sidecar
 * becomes the real answer on the next frame.
 */
function createAuthProbe(log: Logger, config: AgentConfig, binary: string) {
  let cached: { at: number; state: AuthState } | null = null;
  async function probe(): Promise<AuthState> {
    if (cached && Date.now() - cached.at < 60_000) return cached.state;
    let state: AuthState;
    if (process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY) {
      state = 'ok';
    } else {
      try {
        await run(binary, ['auth', 'status'], {
          timeout: 15_000,
          env: { ...process.env, CLAUDE_CONFIG_DIR: config.claudeConfigDir },
        });
        state = 'ok';
      } catch (error) {
        const code = (error as { code?: number | string }).code;
        state = code === 1 ? 'needs_login' : 'unknown';
        // An exit status means it ran and answered. An errno means it never
        // started, and that is worth more than a debug line: it is the same
        // failure every conversation is about to hit, an hour before anyone
        // asks the assistant a question.
        if (typeof code === 'string') {
          log.error('the bundled Claude Code binary would not start', {
            binary,
            code,
            why: diagnoseLaunch({ binary }) ?? String(error),
          });
        } else {
          log.debug('auth probe inconclusive', { code });
        }
      }
    }
    cached = { at: Date.now(), state };
    return state;
  }
  return Object.assign(probe, { peek: (): AuthState => cached?.state ?? 'unknown' });
}

/**
 * Who a set of credentials belongs to.
 *
 * The SDK reports the account during its startup handshake, so this costs a
 * subprocess and no tokens: the query is closed before a prompt is ever sent.
 */
async function readAccount(
  configDir: string,
  log: Logger,
  binary: string,
): Promise<AccountIdentity | null> {
  // An input stream that never produces anything: the handshake is all we want,
  // and a prompt would cost tokens.
  const idle = (async function* () {
    await new Promise(() => {});
    yield undefined as never;
  })();
  const query = sdkForAccount.query({
    prompt: idle as never,
    options: {
      tools: [],
      settingSources: [],
      cwd: configDir,
      // The same binary the conversations and the sign-in use. Left to itself
      // the SDK searches again, and its search is the one that picked the
      // wrong architecture.
      pathToClaudeCodeExecutable: binary,
      env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
    },
  });
  try {
    const init = await Promise.race([
      query.initializationResult(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), 60_000)),
    ]);
    return (init.account as AccountIdentity | undefined) ?? null;
  } catch (error) {
    log.warn('could not read the signed-in account', { error: String(error) });
    return null;
  } finally {
    await query.return(undefined as never).catch(() => undefined);
  }
}

export interface AuthProbe {
  (): Promise<AuthState>;
  /** The last answer, or 'unknown'. Never waits. */
  peek(): AuthState;
}

export function startServer(
  requested: AgentConfig = loadConfig(),
  /** Test seam: a probe that can be made to never answer. */
  overrides: { probeAuth?: AuthProbe } = {},
) {
  const log = createLogger(requested.logLevel);
  const config: AgentConfig = {
    ...requested,
    workspace: ensureWorkspace(requested.workspace, log),
  };
  const claudeBinary = findClaudeBinary();
  const registry = new SessionRegistry(realSdk, config, log, claudeBinary);
  const probeAuth = overrides.probeAuth ?? createAuthProbe(log, config, claudeBinary);
  const failures = new Map<string, { count: number; until: number }>();

  const auth = new AuthService({
    stateDir: config.stateDir,
    claudeConfigDir: config.claudeConfigDir,
    claudeBinary,
    log,
    allowReclaim: config.allowReclaim,
    readAccount: (configDir) => readAccount(configDir, log, claudeBinary),
  });
  void auth.load();

  const handle = createHttpHandler({
    auth,
    config,
    log,
    version: VERSION,
    verifyFixedToken: (token) => Boolean(config.token && token && sameToken(config.token, token)),
    probeAuth,
    sessions: () => registry.size,
  });

  const http = createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => {
      log.error('request failed', { error: String(error) });
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Something went wrong.' }));
    });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.maxFrameBytes });

  http.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    // A browser always sends Origin; a missing one means a non-browser client,
    // which is fine on loopback and refused anywhere else.
    const originOk = origin
      ? config.allowedOrigins.includes(origin)
      : isLoopbackPeer(req.socket.remoteAddress);
    if (!originOk) {
      log.warn('refused an origin', { origin });
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    const ip = req.socket.remoteAddress ?? 'unknown';
    const blocked = failures.get(ip);
    if (blocked && blocked.until > Date.now()) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      socket.destroy();
      return;
    }
    const cookieToken = readCookie(req.headers.cookie, SESSION_COOKIE);
    wss.handleUpgrade(req, socket, head, (ws) => handleSocket(ws, ip, cookieToken));
  });

  /**
   * A socket is allowed when it carries a session minted by signing in, the
   * cookie that sign-in set, or the fixed token where one is configured.
   */
  function authorize(token: string | undefined, cookieToken: string | null): boolean {
    if (config.token && token && sameToken(config.token, token)) return true;
    if (auth.verify(token) || auth.verify(cookieToken)) return true;
    // Nothing about a connection proves it came from this machine — a sidecar
    // on 127.0.0.1 behind a reverse proxy sees every internet client as local
    // — so serving an anonymous caller is something the operator turns on
    // deliberately, and only on loopback.
    return config.allowAnonymous;
  }

  function handleSocket(ws: WebSocket, ip: string, cookieToken: string | null): void {
    let sessionId: string | null = null;
    let greeted = false;

    const send = (frame: ServerFrame) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame));
    };

    // A client that never says hello is not a client.
    const helloDeadline = setTimeout(() => {
      if (!greeted) ws.close(CLOSE_CODES.unauthorized, 'no hello');
    }, 5000);

    ws.on('message', (raw) => {
      const frame = parseClientFrame(raw.toString());
      if (!frame) return;

      if (frame.type === 'hello') {
        if (greeted) return;
        if (!authorize(frame.token, cookieToken)) {
          const record = failures.get(ip) ?? { count: 0, until: 0 };
          record.count += 1;
          if (record.count >= 5) record.until = Date.now() + 10 * 60_000;
          failures.set(ip, record);
          log.warn('refused a socket', { ip });
          ws.close(CLOSE_CODES.unauthorized, 'not signed in');
          return;
        }
        failures.delete(ip);
        greeted = true;
        clearTimeout(helloDeadline);

        const id = frame.conversationId ?? newConversationId();
        const session = registry.open(id, {
          localDate: frame.app.localDate,
          timeZone: frame.app.timeZone,
          appBuild: frame.app.buildId,
        });
        if (!session) {
          ws.close(CLOSE_CODES.busy, 'too many conversations');
          return;
        }
        sessionId = id;
        // A second device on the same conversation takes it over.
        const { replayedFrom } = session.attach(send, frame.lastSeq);

        send({
          type: 'welcome',
          seq: session.currentSeq,
          protocolVersion: PROTOCOL_VERSION,
          conversationId: id,
          replayedFrom,
          sidecar: {
            version: VERSION,
            account: auth.owner?.account ?? null,
            authState: probeAuth.peek(),
          },
        } as ServerFrame);
        // Refresh for the next connection; nothing is waiting on it.
        void probeAuth();
        return;
      }

      if (!greeted || !sessionId) return;
      const session = registry.get(sessionId);
      if (!session) return;

      switch (frame.type) {
        case 'turn': {
          const content =
            typeof frame.content === 'string'
              ? frame.content
              : frame.content.map((block) =>
                  block.type === 'text'
                    ? { type: 'text' as const, text: block.text }
                    : { type: 'image' as const, source: block.source },
                );
          void session
            .send(content as never, frame.turnId, frame.profile ?? 'quick')
            .catch((error: unknown) => {
              send({
                type: 'result',
                seq: session.currentSeq + 1,
                turnId: frame.turnId,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              } as ServerFrame);
            });
          return;
        }
        case 'rpc_result':
          session.answerRpc(frame.id, frame.ok, frame.result, frame.error);
          return;
        case 'interrupt':
          void session.interrupt();
          return;
        case 'new_conversation':
          void session.close('the learner started a new chat');
          sessionId = null;
          greeted = false;
          return;
        case 'ping':
          session.sendDirect({ type: 'pong' });
          return;
        default:
          return;
      }
    });

    ws.on('close', () => {
      clearTimeout(helloDeadline);
      if (sessionId) registry.get(sessionId)?.detach();
    });
    ws.on('error', (error) => log.warn('socket error', { error: String(error) }));
  }

  http.listen(config.port, config.host, () => {
    // Warm the credential check now, so the first app to connect finds an
    // answer waiting instead of a cold 'unknown'.
    void probeAuth();
    log.info(`sidecar listening on ${config.host}:${config.port}`, {
      origins: config.allowedOrigins,
      auth: config.token ? 'token' : 'loopback only',
    });
    if (auth.claimed) {
      log.info('signed in; open the app and it will connect');
    } else if (config.allowAnonymous) {
      log.warn('anonymous access is on: anyone who can reach this socket may use it');
    } else if (config.token) {
      log.info('opened with a fixed token; the app asks for it');
    } else {
      log.info('not claimed yet: open the app at this address and sign in to Claude');
    }
  });

  const shutdown = async () => {
    log.info('shutting down');
    auth.cancelAll();
    await registry.closeAll('the sidecar is stopping');
    http.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { http, wss, registry, auth };
}

const isEntry = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''));
if (isEntry) {
  try {
    startServer();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
