import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';

/**
 * A sidecar that never talks to a model.
 *
 * It speaks the real protocol, so the app's client, executor, journal and panel
 * are all exercised; only the part that would cost money and vary between runs
 * is scripted.
 */
export interface FakeSidecar {
  url: string;
  httpUrl: string;
  close: () => Promise<void>;
}

/** The sign-in the app drives, scripted rather than talking to Claude. */
export interface FakeAuth {
  claimed?: boolean;
  /** The code the fake sidecar will accept. */
  acceptCode?: string;
  signInUrl?: string;
}

type Step = { say: string } | { call: string; input: unknown } | { finish: string };

export async function startFakeSidecar(script: Step[], auth: FakeAuth = {}): Promise<FakeSidecar> {
  const acceptCode = auth.acceptCode ?? 'good-code';
  const signInUrl = auth.signInUrl ?? 'https://claude.com/cai/oauth/authorize?code=true&state=x';
  let claimed = auth.claimed ?? false;
  let session: string | null = null;

  // The same origin serves the sign-in endpoints and the socket, exactly as
  // the real sidecar does.
  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin ?? '*';
    const headers = {
      'content-type': 'application/json',
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers).end();
      return;
    }
    const token = req.headers.authorization?.replace('Bearer ', '') ?? null;
    const authenticated = Boolean(session && token === session);

    if (req.url === '/auth/state') {
      res.writeHead(200, headers).end(
        JSON.stringify({
          claimed,
          authenticated,
          signedIn: claimed,
          account: claimed ? { email: 'owner@example.com' } : null,
          canSignIn: !claimed || authenticated,
        }),
      );
      return;
    }
    if (req.url === '/auth/start') {
      res.writeHead(200, headers).end(JSON.stringify({ loginId: 'login-1', url: signInUrl }));
      return;
    }
    if (req.url === '/auth/code') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const parsed = JSON.parse(body || '{}') as { code?: string };
        if (parsed.code !== acceptCode) {
          res.writeHead(400, headers).end(JSON.stringify({ error: 'That code was not accepted.' }));
          return;
        }
        claimed = true;
        session = 'session-token-1';
        res.writeHead(200, headers).end(
          JSON.stringify({
            token: session,
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            account: { email: 'owner@example.com' },
          }),
        );
      });
      return;
    }
    res.writeHead(200, headers).end('{}');
  });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const port = (http.address() as { port: number }).port;
  const wss = new WebSocketServer({ server: http });

  wss.on('connection', (socket: WebSocket) => {
    let seq = 0;
    const send = (frame: Record<string, unknown>) => {
      seq += 1;
      socket.send(JSON.stringify({ ...frame, seq }));
    };
    const pending = new Map<string, () => void>();

    socket.on('message', async (raw) => {
      const frame = JSON.parse(raw.toString()) as Record<string, unknown>;

      if (frame.type === 'hello') {
        send({
          type: 'welcome',
          protocolVersion: 1,
          conversationId: '00000000-0000-4000-8000-000000000001',
          replayedFrom: null,
          sidecar: {
            version: 'fake',
            account: { email: 'learner@example.com' },
            authState: 'ok',
          },
        });
        return;
      }

      if (frame.type === 'rpc_result') {
        pending.get(String(frame.id))?.();
        pending.delete(String(frame.id));
        return;
      }

      if (frame.type !== 'turn') return;
      const turnId = String(frame.turnId);
      send({
        type: 'turn_started',
        turnId,
        conversationId: '00000000-0000-4000-8000-000000000001',
      });

      for (const step of script) {
        if ('say' in step) {
          send({ type: 'delta', turnId, text: step.say });
        } else if ('call' in step) {
          const id = `rpc-${Math.random().toString(36).slice(2)}`;
          send({ type: 'tool_started', turnId, callId: id, tool: `mcp__fanzitong__${step.call}` });
          const answered = new Promise<void>((resolve) => pending.set(id, resolve));
          send({ type: 'rpc', turnId, id, method: step.call, input: step.input });
          await answered;
        } else {
          send({ type: 'result', turnId, ok: true, text: step.finish, costUsd: 0.01, numTurns: 1 });
        }
      }
    });
  });

  return {
    url: `ws://127.0.0.1:${port}`,
    httpUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close(() => http.close(() => resolve()));
      }),
  };
}
