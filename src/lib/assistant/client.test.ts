import { AssistantClient, type ClientOptions } from './client';
import type { ServerFrame } from './protocol';

/** A WebSocket stand-in the test drives frame by frame. */
class FakeSocket {
  static last: FakeSocket | null = null;
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
  send(raw: string) {
    this.sent.push(JSON.parse(raw));
  }
  closeCalls = 0;
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.closeCalls += 1;
    // A real socket reports the close it was asked for.
    this.onclose?.({ code: 1000 });
  }
  accept() {
    this.readyState = 1;
    this.onopen?.();
  }
  deliver(frame: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const opened: AssistantClient[] = [];

function makeClient(over: Partial<ClientOptions> = {}) {
  const frames: ServerFrame[] = [];
  const states: { state: string; detail?: string }[] = [];
  const client = new AssistantClient({
    endpoint: 'wss://agent.example/ws',
    token: 'secret',
    onRpc: async () => ({ result: { ok: true } }),
    onFrame: (frame) => frames.push(frame),
    onState: (state, detail) => states.push({ state, detail }),
    socketFactory: (url) => new FakeSocket(url) as unknown as WebSocket,
    ...over,
  });
  opened.push(client);
  return { client, frames, states };
}

const welcome = {
  type: 'welcome',
  seq: 1,
  protocolVersion: 1,
  conversationId: '11111111-1111-4111-8111-111111111111',
  replayedFrom: null,
  sidecar: { version: '1.0.0', account: null, authState: 'ok' },
};

beforeEach(() => {
  FakeSocket.last = null;
});

// Every client owns a heartbeat interval; leaving them running outlives the test.
afterEach(() => {
  for (const client of opened.splice(0)) client.close();
});

describe('AssistantClient', () => {
  it('introduces itself with the token and the phone’s own date', () => {
    const { client } = makeClient();
    client.connect();
    FakeSocket.last!.accept();
    const hello = FakeSocket.last!.sent[0];
    expect(hello.type).toBe('hello');
    expect(hello.token).toBe('secret');
    expect((hello.app as { localDate: string }).localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('remembers the conversation and asks for what it missed on reconnect', () => {
    const { client } = makeClient();
    client.connect();
    FakeSocket.last!.accept();
    FakeSocket.last!.deliver(welcome);
    FakeSocket.last!.deliver({ type: 'delta', seq: 7, text: 'Hello' });

    FakeSocket.last!.drop();
    client.nudge();
    FakeSocket.last!.accept();
    const hello = FakeSocket.last!.sent[0];
    expect(hello.conversationId).toBe(welcome.conversationId);
    expect(hello.lastSeq).toBe(7);
  });

  it('answers a tool call from the sidecar', async () => {
    const calls: string[] = [];
    const { client } = makeClient({
      onRpc: async (method: string) => {
        calls.push(method);
        return { result: { total: 2 } };
      },
    });
    client.connect();
    FakeSocket.last!.accept();
    FakeSocket.last!.deliver({
      type: 'rpc',
      seq: 2,
      id: 'rpc-1',
      method: 'deck_overview',
      input: {},
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(calls).toEqual(['deck_overview']);
    const answer = FakeSocket.last!.sent.find((f) => f.type === 'rpc_result');
    expect(answer).toMatchObject({ id: 'rpc-1', ok: true });
  });

  it('reports a failing tool call rather than leaving the turn hanging', async () => {
    const { client } = makeClient({
      onRpc: async () => {
        throw new Error('IndexedDB is unavailable');
      },
    });
    client.connect();
    FakeSocket.last!.accept();
    FakeSocket.last!.deliver({
      type: 'rpc',
      seq: 2,
      id: 'rpc-2',
      method: 'deck_overview',
      input: {},
    });
    await Promise.resolve();
    await Promise.resolve();
    const answer = FakeSocket.last!.sent.find((f) => f.type === 'rpc_result');
    expect(answer).toMatchObject({ ok: false, error: 'IndexedDB is unavailable' });
  });

  it('explains a rejected token instead of retrying forever', () => {
    const { client, states } = makeClient();
    client.connect();
    FakeSocket.last!.accept();
    FakeSocket.last!.drop(4401);
    expect(states.at(-1)?.state).toBe('unauthorized');
  });

  it('does not send a turn while the socket is down', () => {
    const { client } = makeClient();
    client.connect();
    FakeSocket.last!.drop();
    expect(client.ask('hello')).toBeNull();
  });

  it('sends a turn with its profile once connected', () => {
    const { client } = makeClient();
    client.connect();
    FakeSocket.last!.accept();
    const turnId = client.ask('write a sentence', { profile: 'quick', label: '滷肉飯' });
    expect(turnId).toEqual(expect.any(String));
    const turn = FakeSocket.last!.sent.find((f) => f.type === 'turn');
    expect(turn).toMatchObject({ profile: 'quick', label: '滷肉飯' });
  });
});

describe('the heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Connect and get past the handshake, which is what starts the beating. */
  function connected() {
    const made = makeClient();
    made.client.connect();
    FakeSocket.last!.accept();
    FakeSocket.last!.deliver(welcome);
    return { ...made, socket: FakeSocket.last! };
  }

  it('keeps talking often enough that a proxy does not call the socket idle', () => {
    const { socket } = connected();

    // nginx closes a connection it has read nothing from for sixty seconds,
    // and it is not the only proxy that does.
    vi.advanceTimersByTime(59_000);

    expect(socket.sent.filter((f) => f.type === 'ping').length).toBeGreaterThanOrEqual(2);
  });

  it('gives up on a socket that has stopped answering and opens another', () => {
    const { socket, states } = connected();

    vi.advanceTimersByTime(80_000);

    expect(socket.closeCalls).toBe(1);
    expect(states.map((s) => s.state)).toContain('offline');
    // Dropping it is only half the point: the reconnect is what recovers the
    // turn the dead socket swallowed.
    expect(FakeSocket.last).not.toBe(socket);
  });

  it('holds on while the sidecar is still answering', () => {
    const { socket } = connected();

    for (let beat = 0; beat < 4; beat += 1) {
      vi.advanceTimersByTime(25_000);
      socket.deliver({ type: 'pong', seq: 2 + beat });
    }

    expect(socket.closeCalls).toBe(0);
  });

  it('does not let a pong stand in for the transcript', () => {
    const { client, frames, socket } = connected();
    socket.deliver({ type: 'delta', seq: 7, text: 'Hello' });
    socket.deliver({ type: 'pong', seq: 8 });

    expect(frames.some((f) => f.type === 'pong')).toBe(false);

    socket.drop();
    client.nudge();
    FakeSocket.last!.accept();
    // The sidecar never buffered that pong, so 7 is the frame to resume from.
    expect(FakeSocket.last!.sent[0].lastSeq).toBe(7);
  });
});
