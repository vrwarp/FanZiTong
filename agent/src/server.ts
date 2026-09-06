/**
 * The sidecar process.
 *
 * It holds the Claude Code login and nothing else: the deck stays in the
 * browser, and every tool call is answered by the app over this socket.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  CLOSE_CODES,
  LIMITS,
  PROTOCOL_VERSION,
  parseClientFrame,
  type ServerFrame,
} from '@/lib/assistant/protocol';
import { loadConfig, generateToken, type AgentConfig } from './config';
import { createLogger, type Logger } from './log';
import { SessionRegistry } from './registry';
import { newConversationId } from './session';
import { realSdk } from './sdk';

const run = promisify(execFile);
const VERSION = '1.0.0';

function sameToken(expected: string, given: string): boolean {
  // Hash first so the comparison length never leaks the token length.
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(given).digest();
  return timingSafeEqual(a, b);
}

/** Ask the bundled CLI whether it has credentials. Cached: it spawns a process. */
function createAuthProbe(log: Logger) {
  let cached: { at: number; state: 'ok' | 'needs_login' | 'unknown' } | null = null;
  return async function probe(): Promise<'ok' | 'needs_login' | 'unknown'> {
    if (cached && Date.now() - cached.at < 60_000) return cached.state;
    let state: 'ok' | 'needs_login' | 'unknown';
    if (process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY) {
      state = 'ok';
    } else {
      try {
        await run('claude', ['auth', 'status'], { timeout: 10_000 });
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

export function startServer(config: AgentConfig = loadConfig()) {
  const log = createLogger(config.logLevel);
  const registry = new SessionRegistry(realSdk, config, log);
  const probeAuth = createAuthProbe(log);
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(config.host);
  const failures = new Map<string, { count: number; until: number }>();

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, version: VERSION, sessions: registry.size }));
      return;
    }
    if (req.url === '/readyz') {
      void probeAuth().then((auth) => {
        res.writeHead(auth === 'ok' ? 200 : 503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ auth, version: VERSION }));
      });
      return;
    }
    res.writeHead(404).end();
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.maxFrameBytes });

  http.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    // A browser always sends Origin; a missing one means a non-browser client,
    // which is fine on loopback and refused anywhere else.
    const originOk = origin ? config.allowedOrigins.includes(origin) : loopback;
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
    wss.handleUpgrade(req, socket, head, (ws) => handleSocket(ws, ip));
  });

  function handleSocket(ws: WebSocket, ip: string): void {
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
        if (config.token && (!frame.token || !sameToken(config.token, frame.token))) {
          const record = failures.get(ip) ?? { count: 0, until: 0 };
          record.count += 1;
          if (record.count >= 5) record.until = Date.now() + 10 * 60_000;
          failures.set(ip, record);
          log.warn('rejected a pairing token', { ip });
          ws.close(CLOSE_CODES.unauthorized, 'bad token');
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

        void probeAuth().then((auth) => {
          send({
            type: 'welcome',
            seq: session.currentSeq,
            protocolVersion: PROTOCOL_VERSION,
            conversationId: id,
            replayedFrom,
            sidecar: { version: VERSION, account: null, authState: auth },
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
    if (!config.token && loopback) {
      log.info('no token set: only loopback clients can connect');
    }
  });

  const shutdown = async () => {
    log.info('shutting down');
    await registry.closeAll('the sidecar is stopping');
    http.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { http, wss, registry };
}

const isEntry = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''));
if (isEntry) {
  try {
    startServer();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error('\nGenerate a token with: openssl rand -base64 32');
    console.error(`or use this one: ${generateToken()}`);
    process.exit(1);
  }
}
