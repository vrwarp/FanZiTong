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
  close: () => Promise<void>;
}

type Step = { say: string } | { call: string; input: unknown } | { finish: string };

export async function startFakeSidecar(script: Step[]): Promise<FakeSidecar> {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.once('listening', resolve));
  const port = (wss.address() as { port: number }).port;

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
    close: () =>
      new Promise<void>((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close(() => resolve());
      }),
  };
}
