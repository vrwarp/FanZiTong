/**
 * The socket to the sidecar.
 *
 * Written for a phone: it reconnects when the app comes back to the
 * foreground, tells the sidecar the last frame it saw so nothing is missed,
 * and answers tool calls from whatever executor it was given.
 */
import { uuid } from '@/lib/util/id';
import {
  LIMITS,
  PROTOCOL_VERSION,
  parseServerFrame,
  type ContentBlock,
  type ServerFrame,
} from './protocol';
import type { ProfileName } from './profiles';

export interface ClientOptions {
  endpoint: string;
  token: string;
  buildId?: string;
  conversationId?: string | null;
  /** Runs a tool call and returns what the sidecar should hear back. */
  onRpc: (method: string, input: unknown) => Promise<{ result: unknown; isError?: boolean }>;
  onFrame: (frame: ServerFrame) => void;
  onState: (
    state: 'connecting' | 'connected' | 'offline' | 'unauthorized' | 'error',
    detail?: string,
  ) => void;
  /** Injectable so tests do not need a real socket. */
  socketFactory?: (url: string) => WebSocket;
  now?: () => Date;
}

const BACKOFF_MS = [1000, 2000, 5000, 10_000, 30_000];

/**
 * Between turns the socket carries nothing at all, and a reverse proxy reads
 * silence as an abandoned connection: nginx closes one after sixty seconds by
 * default. A beat well inside that keeps it open wherever the sidecar is
 * published from.
 *
 * It is also how the app learns a socket has already died. A phone that
 * changes network leaves a half-open connection the browser keeps calling
 * `OPEN`, sometimes for minutes, and a turn sent into it is simply lost.
 */
const HEARTBEAT_MS = 25_000;
/** Two beats with nothing back. Every frame counts, not just a pong. */
const SILENCE_LIMIT_MS = HEARTBEAT_MS * 2 + 5_000;

export class AssistantClient {
  private socket: WebSocket | null = null;
  private attempt = 0;
  private lastSeq = 0;
  private conversationId: string | null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heardAt = 0;
  private closedByUs = false;
  private started = false;

  constructor(private readonly options: ClientOptions) {
    this.conversationId = options.conversationId ?? null;
  }

  get conversation(): string | null {
    return this.conversationId;
  }

  connect(): void {
    this.started = true;
    this.closedByUs = false;
    this.open();
  }

  /** Called on visibility and online events: reconnect now rather than waiting. */
  nudge(): void {
    if (!this.started || this.closedByUs) return;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.attempt = 0;
    this.open();
  }

  private now(): number {
    return (this.options.now?.() ?? new Date()).getTime();
  }

  private open(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    const factory = this.options.socketFactory ?? ((url: string) => new WebSocket(url));
    this.options.onState('connecting');
    let socket: WebSocket;
    try {
      socket = factory(this.options.endpoint);
    } catch (error) {
      this.options.onState('error', error instanceof Error ? error.message : String(error));
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      const now = this.options.now?.() ?? new Date();
      this.send({
        type: 'hello',
        protocolVersion: PROTOCOL_VERSION,
        token: this.options.token,
        ...(this.conversationId ? { conversationId: this.conversationId } : {}),
        ...(this.lastSeq ? { lastSeq: this.lastSeq } : {}),
        app: {
          buildId: this.options.buildId,
          // The sidecar may be in another time zone; "today" is the phone's.
          localDate: now.toISOString().slice(0, 10),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      this.startHeartbeat();
    };

    socket.onmessage = (event: MessageEvent) => {
      // Anything arriving proves the connection is alive, parseable or not.
      this.heardAt = this.now();
      const frame = parseServerFrame(String(event.data));
      if (!frame) return;
      // A pong says the socket is alive and nothing more. It never entered the
      // sidecar's replay ring, so it is not the frame to resume from, and it
      // is not something the panel should be shown either.
      if (frame.type === 'pong') return;
      this.lastSeq = Math.max(this.lastSeq, frame.seq);
      if (frame.type === 'welcome') {
        this.attempt = 0;
        this.conversationId = frame.conversationId;
        // A replay the sidecar could not satisfy means our transcript is stale.
        if (frame.replayedFrom === null && this.lastSeq > frame.seq) this.lastSeq = frame.seq;
      }
      if (frame.type === 'rpc') {
        void this.handleRpc(frame);
        return;
      }
      this.options.onFrame(frame);
    };

    socket.onclose = (event: CloseEvent) => {
      this.socket = null;
      this.stopHeartbeat();
      if (this.closedByUs) return;
      if (event.code === 4401) {
        this.options.onState('unauthorized', 'The sidecar rejected this pairing token.');
        return;
      }
      if (event.code === 4403) {
        this.options.onState(
          'unauthorized',
          'The sidecar is not configured to accept this app’s address.',
        );
        return;
      }
      this.options.onState('offline');
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      // `onclose` always follows, and carries the code worth reporting.
    };
  }

  private async handleRpc(frame: Extract<ServerFrame, { type: 'rpc' }>): Promise<void> {
    try {
      const outcome = await this.options.onRpc(frame.method, frame.input);
      this.send({ type: 'rpc_result', id: frame.id, ok: true, result: outcome });
    } catch (error) {
      this.send({
        type: 'rpc_result',
        id: frame.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heardAt = this.now();
    this.heartbeatTimer = setInterval(() => this.beat(), HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private beat(): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (this.now() - this.heardAt > SILENCE_LIMIT_MS) {
      // The browser still calls this open, but nothing has come back for two
      // beats. Closing it is what starts the reconnect, which replays whatever
      // the sidecar said while we were talking to a dead socket.
      this.stopHeartbeat();
      socket.close();
      return;
    }
    this.send({ type: 'ping' });
  }

  private scheduleReconnect(): void {
    if (this.closedByUs || this.reconnectTimer) return;
    // Backing off while hidden is pointless: `nudge` reconnects on return.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const wait = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, wait);
  }

  private send(frame: unknown): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(frame));
    return true;
  }

  /** Send a turn. Returns its id so the caller can show it immediately. */
  ask(
    content: string | ContentBlock[],
    options: { profile?: ProfileName; label?: string } = {},
  ): string | null {
    const turnId = uuid();
    const frame = {
      type: 'turn' as const,
      turnId,
      content,
      profile: options.profile,
      label: options.label,
    };
    if (JSON.stringify(frame).length > LIMITS.maxFrameBytes) return null;
    return this.send(frame) ? turnId : null;
  }

  /** Tell the model something without asking it to reply. */
  note(text: string): void {
    this.send({ type: 'note', text });
  }

  interrupt(): void {
    this.send({ type: 'interrupt' });
  }

  newConversation(): void {
    this.send({ type: 'new_conversation' });
    this.conversationId = null;
    this.lastSeq = 0;
  }

  close(): void {
    this.closedByUs = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
  }
}
