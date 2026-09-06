/**
 * Calling back into the browser.
 *
 * The deck lives in the app, so every tool the model calls becomes a request
 * over the socket. When the phone is asleep the socket is gone but the turn is
 * not: calls queue until it reattaches, and only give up when the detach grace
 * has run out.
 */
import { randomUUID } from 'node:crypto';

export interface BridgeResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface Pending {
  resolve: (value: BridgeResult) => void;
  timer: NodeJS.Timeout;
}

export interface BridgeDeps {
  /** Send a frame if the client is attached; false when it is not. */
  send: (frame: { id: string; method: string; input: unknown; timeoutMs: number }) => boolean;
  timeoutMs: number;
}

export class ClientBridge {
  private readonly pending = new Map<string, Pending>();
  private readonly queued: { id: string; method: string; input: unknown }[] = [];
  private closed = false;

  constructor(private readonly deps: BridgeDeps) {}

  /** Ask the app to run one tool call. Resolves; never rejects. */
  call(method: string, input: unknown): Promise<BridgeResult> {
    if (this.closed) {
      return Promise.resolve({ ok: false, error: 'The app disconnected.' });
    }
    const id = randomUUID();
    return new Promise<BridgeResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.drop(id);
        resolve({
          ok: false,
          error: 'The app did not answer in time; it may be closed or offline.',
        });
      }, this.deps.timeoutMs);
      this.pending.set(id, { resolve, timer });

      const frame = { id, method, input, timeoutMs: this.deps.timeoutMs };
      if (!this.deps.send(frame)) this.queued.push({ id, method, input });
    });
  }

  /** The client answered. */
  settle(id: string, result: BridgeResult): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.resolve(result);
  }

  /** The client came back: send everything that piled up while it was away. */
  flush(): void {
    while (this.queued.length > 0) {
      const item = this.queued.shift();
      if (!item || !this.pending.has(item.id)) continue;
      const sent = this.deps.send({ ...item, timeoutMs: this.deps.timeoutMs });
      if (!sent) {
        this.queued.unshift(item);
        return;
      }
    }
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  /** Give up on everything: the turn is over or the client is gone for good. */
  close(reason = 'The app disconnected.'): void {
    this.closed = true;
    this.queued.length = 0;
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.resolve({ ok: false, error: reason });
      this.pending.delete(id);
    }
  }

  private drop(id: string): void {
    const index = this.queued.findIndex((q) => q.id === id);
    if (index >= 0) this.queued.splice(index, 1);
  }
}
