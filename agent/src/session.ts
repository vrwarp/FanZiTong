/**
 * One conversation: a live `query()` fed by a queue of user turns.
 *
 * Three things shape this design. The subprocess is expensive to start, so it
 * is kept warm and every turn goes into the same one. The phone drops its
 * socket the moment it is locked, so outgoing frames are numbered and buffered
 * for replay rather than lost. And a turn that is mid-flight when that happens
 * keeps running, because finishing is usually what the learner wanted.
 */
import { randomUUID } from 'node:crypto';
import { PROFILES, type ProfileName } from '@/lib/assistant/profiles';
import { AUTO_ALLOWED_TOOLS } from '@/lib/assistant/tools';
import { LIMITS, type ServerFrame } from '@/lib/assistant/protocol';
import type { AgentConfig } from './config';
import type { Logger } from './log';
import { ClientBridge } from './bridge';
import { buildHooks } from './hooks';
import { buildDeckServer } from './tools';
import { buildSystemPrompt, type SessionFacts } from './prompt';
import type { Options, Query, SDKUserMessage, SdkApi } from './sdk';

/**
 * A frame before the session stamps its sequence number. `Omit` over a union
 * would collapse it to the shared keys, so distribute over the members.
 */
type WithoutSeq<T> = T extends unknown ? Omit<T, 'seq'> : never;
export type OutgoingFrame = WithoutSeq<ServerFrame>;

export interface SessionDeps {
  sdk: SdkApi;
  config: AgentConfig;
  log: Logger;
  facts: SessionFacts;
}

interface QueuedTurn {
  message: SDKUserMessage;
  turnId: string;
  profile: ProfileName;
}

/** An async iterable the session pushes user messages into. */
class TurnQueue implements AsyncIterable<SDKUserMessage> {
  private readonly waiting: QueuedTurn[] = [];
  private resolve: ((value: IteratorResult<SDKUserMessage>) => void) | null = null;
  private done = false;

  push(turn: QueuedTurn): void {
    if (this.done) return;
    if (this.resolve) {
      const settle = this.resolve;
      this.resolve = null;
      settle({ value: turn.message, done: false });
      return;
    }
    this.waiting.push(turn);
  }

  close(): void {
    this.done = true;
    if (this.resolve) {
      const settle = this.resolve;
      this.resolve = null;
      settle({ value: undefined as never, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: (): Promise<IteratorResult<SDKUserMessage>> => {
        const queued = this.waiting.shift();
        if (queued) return Promise.resolve({ value: queued.message, done: false });
        if (this.done) return Promise.resolve({ value: undefined as never, done: true });
        return new Promise((resolve) => {
          this.resolve = resolve;
        });
      },
    };
  }
}

export class AgentSession {
  readonly id: string;
  readonly bridge: ClientBridge;

  private query: Query | null = null;
  private input: TurnQueue | null = null;
  private abort: AbortController | null = null;
  private sink: ((frame: ServerFrame) => void) | null = null;
  private readonly buffer: ServerFrame[] = [];
  private seq = 0;
  private sdkSessionId: string | null = null;
  private currentTurn: string | null = null;
  private turnStartedAt = 0;
  private firstTokenAt = 0;
  private readonly spent = { count: 0 };
  private idleTimer: NodeJS.Timeout | null = null;
  private detachTimer: NodeJS.Timeout | null = null;
  private profile: ProfileName = 'quick';
  private closed = false;

  constructor(
    id: string,
    private readonly deps: SessionDeps,
    private readonly onClosed: (id: string) => void,
  ) {
    this.id = id;
    this.bridge = new ClientBridge({
      send: (frame) =>
        this.emit({
          type: 'rpc',
          id: frame.id,
          method: frame.method,
          input: frame.input,
          timeoutMs: frame.timeoutMs,
        }),
      timeoutMs: deps.config.rpcTimeoutMs,
    });
  }

  // ---- client attachment ------------------------------------------------

  /** A socket arrives (or comes back). Returns the frames it missed. */
  attach(sink: (frame: ServerFrame) => void, lastSeq?: number): { replayedFrom: number | null } {
    this.sink = sink;
    if (this.detachTimer) {
      clearTimeout(this.detachTimer);
      this.detachTimer = null;
    }
    let replayedFrom: number | null = null;
    if (lastSeq !== undefined && this.buffer.length > 0) {
      const oldest = this.buffer[0].seq;
      if (lastSeq + 1 >= oldest) {
        const missed = this.buffer.filter((f) => f.seq > lastSeq);
        replayedFrom = lastSeq;
        for (const frame of missed) sink(frame);
      }
    }
    this.bridge.flush();
    return { replayedFrom };
  }

  /** The socket went away. Keep working for a while: it is probably a lock screen. */
  detach(): void {
    this.sink = null;
    if (this.closed || this.detachTimer) return;
    this.detachTimer = setTimeout(() => {
      this.deps.log.info('session closed after detach grace', { id: this.id });
      void this.close('the app stayed away');
    }, this.deps.config.detachGraceMs);
  }

  get attached(): boolean {
    return this.sink !== null;
  }

  get sdkSession(): string | null {
    return this.sdkSessionId;
  }

  // ---- turns ------------------------------------------------------------

  async send(
    content: SDKUserMessage['message']['content'],
    turnId: string,
    profile: ProfileName,
  ): Promise<void> {
    if (this.closed) throw new Error('This conversation is closed.');
    this.touchIdle();
    this.currentTurn = turnId;
    this.turnStartedAt = Date.now();
    this.firstTokenAt = 0;
    this.spent.count = 0;

    const message: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content },
      parent_tool_use_id: null,
      uuid: turnId as SDKUserMessage['uuid'],
      session_id: this.sdkSessionId ?? '',
    };

    if (!this.query) {
      this.profile = profile;
      this.start(message, turnId);
      return;
    }
    if (profile !== this.profile) {
      this.profile = profile;
      try {
        await this.query.setModel(PROFILES[profile].model);
      } catch (error) {
        this.deps.log.warn('could not switch model mid-conversation', { error: String(error) });
      }
    }
    this.input?.push({ message, turnId, profile });
  }

  async interrupt(): Promise<void> {
    try {
      await this.query?.interrupt();
    } catch (error) {
      this.deps.log.warn('interrupt failed', { error: String(error) });
    }
  }

  answerRpc(id: string, ok: boolean, result?: unknown, error?: string): void {
    this.bridge.settle(id, { ok, result, error });
  }

  // ---- lifecycle --------------------------------------------------------

  private start(first: SDKUserMessage, turnId: string): void {
    const { sdk, config, log } = this.deps;
    const queue = new TurnQueue();
    this.input = queue;
    queue.push({ message: first, turnId, profile: this.profile });

    const abort = new AbortController();
    this.abort = abort;
    const settings = PROFILES[this.profile];

    const options: Options = {
      abortController: abort,
      cwd: config.workspace,
      // The model may not touch this host: no Bash, no file access, nothing but
      // the deck tools. The sidecar is reachable from a phone and reads text
      // the learner photographed, so the tool surface is the security boundary.
      tools: [],
      allowedTools: AUTO_ALLOWED_TOOLS,
      mcpServers: { fanzitong: buildDeckServer(sdk, this.bridge) },
      strictMcpConfig: true,
      permissionMode: 'default',
      settingSources: [],
      systemPrompt: buildSystemPrompt(sdk.dynamicBoundary, this.deps.facts),
      model: settings.model,
      fallbackModel: PROFILES.quick.model,
      effort: settings.effort,
      thinking: { type: 'adaptive', display: 'summarized' },
      maxTurns: settings.maxTurns,
      includePartialMessages: true,
      promptSuggestions: true,
      hooks: buildHooks({ bridge: this.bridge, spent: this.spent }),
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: 'fanzitong-agent/1.0.0' },
      stderr: (data: string) => log.debug('claude stderr', { data: data.slice(0, 500) }),
    };
    if (config.maxBudgetUsd) options.maxBudgetUsd = config.maxBudgetUsd;
    if (this.sdkSessionId) options.resume = this.sdkSessionId;

    this.query = sdk.query({ prompt: queue, options });
    void this.pump();
  }

  private async pump(): Promise<void> {
    if (!this.query) return;
    try {
      for await (const message of this.query) {
        this.route(message as Record<string, unknown>);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.deps.log.error('conversation failed', { id: this.id, error: text });
      this.emit({ type: 'result', turnId: this.currentTurn ?? undefined, ok: false, error: text });
    } finally {
      this.query = null;
      this.input = null;
    }
  }

  private route(message: Record<string, unknown>): void {
    const type = message.type as string;
    const turnId = this.currentTurn ?? undefined;

    if (type === 'system' && message.subtype === 'init') {
      this.sdkSessionId = (message.session_id as string) ?? this.sdkSessionId;
      this.emit({
        type: 'turn_started',
        turnId,
        conversationId: this.id,
      });
      return;
    }

    if (type === 'stream_event') {
      const event = message.event as { type?: string; delta?: { type?: string; text?: string } };
      if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        if (!this.firstTokenAt) this.firstTokenAt = Date.now();
        this.emit({ type: 'delta', turnId, text: event.delta.text ?? '' });
      }
      return;
    }

    if (type === 'assistant') {
      const content = (message.message as { content?: unknown[] })?.content ?? [];
      for (const block of content as Record<string, unknown>[]) {
        if (block.type === 'tool_use') {
          this.emit({
            type: 'tool_started',
            turnId,
            callId: String(block.id ?? ''),
            tool: String(block.name ?? ''),
          });
        } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
          const summary = block.thinking.trim().split('\n')[0]?.slice(0, 160);
          if (summary) this.emit({ type: 'thinking', turnId, text: summary });
        }
      }
      return;
    }

    if (type === 'result') {
      const ok = message.subtype === 'success';
      this.emit({
        type: 'result',
        turnId,
        ok,
        text: typeof message.result === 'string' ? message.result : undefined,
        costUsd: typeof message.total_cost_usd === 'number' ? message.total_cost_usd : undefined,
        numTurns: typeof message.num_turns === 'number' ? message.num_turns : undefined,
        durationMs: Date.now() - this.turnStartedAt,
        ttftMs: this.firstTokenAt ? this.firstTokenAt - this.turnStartedAt : undefined,
        error: ok ? undefined : String(message.subtype ?? 'The turn did not finish.'),
      });
      this.deps.log.info('turn finished', {
        id: this.id,
        profile: this.profile,
        ok,
        ms: Date.now() - this.turnStartedAt,
        ttft: this.firstTokenAt ? this.firstTokenAt - this.turnStartedAt : null,
        cost: message.total_cost_usd,
      });
      this.touchIdle();
      return;
    }

    if (type === 'system' && message.subtype === 'status') {
      const status = message.status;
      if (status === 'compacting' || status === 'requesting') {
        this.emit({ type: 'status', turnId, status });
      }
      return;
    }

    if (type === 'system' && message.subtype === 'rate_limit_event') {
      this.emit({
        type: 'notice',
        turnId,
        level: 'warning',
        text: 'Claude is rate limiting this account for a while; the assistant will be slow or unavailable until it resets.',
      });
      return;
    }

    if (type === 'system' && message.subtype === 'prompt_suggestion') {
      const text = typeof message.suggestion === 'string' ? message.suggestion : null;
      if (text) this.emit({ type: 'suggestion', turnId, text });
    }
  }

  private emit(frame: OutgoingFrame): boolean {
    this.seq += 1;
    const full = { ...frame, seq: this.seq } as ServerFrame;
    this.buffer.push(full);
    if (this.buffer.length > LIMITS.replayBuffer) this.buffer.shift();
    if (!this.sink) return false;
    this.sink(full);
    return true;
  }

  /** Send a frame that is not part of the replay stream (welcome, pong). */
  sendDirect(frame: OutgoingFrame): void {
    this.seq += 1;
    this.sink?.({ ...frame, seq: this.seq } as ServerFrame);
  }

  get currentSeq(): number {
    return this.seq;
  }

  private touchIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.deps.log.info('closing idle conversation', { id: this.id });
      void this.close('idle');
    }, this.deps.config.idleTimeoutMs);
  }

  async close(reason: string): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.detachTimer) clearTimeout(this.detachTimer);
    this.bridge.close(`The conversation ended (${reason}).`);
    this.input?.close();
    try {
      await this.query?.return(undefined as never);
    } catch {
      this.abort?.abort();
    }
    this.query = null;
    this.onClosed(this.id);
  }
}

export function newConversationId(): string {
  return randomUUID();
}
