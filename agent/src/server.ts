/**
 * The sidecar process.
 *
 * It holds the Claude Code login and nothing else: the deck stays in the
 * browser, and every tool call is answered by the app over this socket.
 */
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
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
function findClaudeBinary(): string {
  const require = createRequire(import.meta.url);
  for (const platform of [
    'linux-x64',
    'linux-arm64',
    'linux-x64-musl',
    'linux-arm64-musl',
    'darwin-arm64',
    'darwin-x64',
  ]) {
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

function sameToken(expected: string, given: string): boolean {
  // Hash first so the comparison length never leaks the token length.
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(given).digest();
  return timingSafeEqual(a, b);
}

/** Ask the bundled CLI whether it has credentials. Cached: it spawns a process. */
function createAuthProbe(log: Logger, config: AgentConfig) {
  let cached: { at: number; state: 'ok' | 'needs_login' | 'unknown' } | null = null;
  return async function probe(): Promise<'ok' | 'needs_login' | 'unknown'> {
    if (cached && Date.now() - cached.at < 60_000) return cached.state;
    let state: 'ok' | 'needs_login' | 'unknown';
    if (process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY) {
      state = 'ok';
    } else {
      try {
        await run(findClaudeBinary(), ['auth', 'status'], {
          timeout: 15_000,
          env: { ...process.env, CLAUDE_CONFIG_DIR: config.claudeConfigDir },
        });
        state = 'ok';
      } catch (error) {
        const code = (error as { code?: number }).code;
        state = code === 1 ? 'needs_login' : 'unknown';
        log.debug('auth probe inconclusive', { code });
      }
    }
    cached = { at: Date.now(), state };
    return state;
  };
}

/**
 * Who a set of credentials belongs to.
 *
 * The SDK reports the account during its startup handshake, so this costs a
 * subprocess and no tokens: the query is closed before a prompt is ever sent.
 */
async function readAccount(configDir: string, log: Logger): Promise<AccountIdentity | null> {
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

export function startServer(config: AgentConfig = loadConfig()) {
  const log = createLogger(config.logLevel);
  const registry = new SessionRegistry(realSdk, config, log);
  const probeAuth = createAuthProbe(log, config);
  const failures = new Map<string, { count: number; until: number }>();

  const auth = new AuthService({
    stateDir: config.stateDir,
    claudeConfigDir: config.claudeConfigDir,
    claudeBinary: findClaudeBinary(),
    log,
    allowReclaim: config.allowReclaim,
    readAccount: (configDir) => readAccount(configDir, log),
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

        void probeAuth().then((authState) => {
          send({
            type: 'welcome',
            seq: session.currentSeq,
            protocolVersion: PROTOCOL_VERSION,
            conversationId: id,
            replayedFrom,
            sidecar: {
              version: VERSION,
              account: auth.owner?.account ?? null,
              authState,
            },
          } as ServerFrame);
        });
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
