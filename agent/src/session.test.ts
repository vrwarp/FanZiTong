import { loadConfig } from './config';
import { createLogger } from './log';
import { AgentSession } from './session';
import type { SdkApi } from './sdk';
import type { ServerFrame } from '@/lib/assistant/protocol';

/**
 * A stand-in for the Agent SDK: it records what the session asked for and
 * replays a scripted conversation, so none of this spawns Claude Code.
 */
function fakeSdk(script: Record<string, unknown>[]) {
  const calls: { options: Record<string, unknown>; inputs: unknown[] }[] = [];
  const sdk: SdkApi = {
    dynamicBoundary: '__BOUNDARY__',
    tool: ((name: string, description: string) => ({
      name,
      description,
    })) as unknown as SdkApi['tool'],
    createSdkMcpServer: ((options: unknown) => options) as unknown as SdkApi['createSdkMcpServer'],
    query: (({ prompt, options }: { prompt: AsyncIterable<unknown>; options: unknown }) => {
      const record = { options: options as Record<string, unknown>, inputs: [] as unknown[] };
      calls.push(record);
      const iterator = (async function* () {
        // Like the real SDK in streaming-input mode: the stream stays open and
        // replays the script for every user message, ending only when the
        // session closes its input queue.
        for await (const message of prompt) {
          record.inputs.push(message);
          for (const item of script) yield item;
        }
      })();
      return Object.assign(iterator, {
        interrupt: async () => undefined,
        setModel: async () => undefined,
        return: async () => ({ done: true, value: undefined }),
      }) as never;
    }) as SdkApi['query'],
  };
  return { sdk, calls };
}

const config = loadConfig({ FZT_AGENT_HOST: '127.0.0.1' } as NodeJS.ProcessEnv);
const log = createLogger('error');

function makeSession(script: Record<string, unknown>[]) {
  const { sdk, calls } = fakeSdk(script);
  const frames: ServerFrame[] = [];
  const session = new AgentSession('conv-1', { sdk, config, log, facts: {} }, () => {});
  session.attach((frame) => frames.push(frame));
  return { session, frames, calls };
}

const initFrame = { type: 'system', subtype: 'init', session_id: 'sdk-session-1' };
const textFrame = {
  type: 'stream_event',
  event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
};
const resultFrame = {
  type: 'result',
  subtype: 'success',
  result: 'Done',
  total_cost_usd: 0.01,
  num_turns: 2,
};

describe('AgentSession', () => {
  it('locks the model out of the host machine', async () => {
    const { session, calls } = makeSession([initFrame, resultFrame]);
    await session.send('hi', 'turn-1', 'quick');
    await new Promise((r) => setTimeout(r, 10));
    const options = calls[0].options;
    expect(options.tools).toEqual([]);
    expect(options.settingSources).toEqual([]);
    expect(options.strictMcpConfig).toBe(true);
    expect(options.allowedTools).toContain('mcp__fanzitong__deck_upsert_cards');
    // The destructive tools are deliberately not auto-allowed.
    expect(options.allowedTools).not.toContain('mcp__fanzitong__deck_delete_cards');
    await session.close('test');
  });

  it('keeps the host environment while naming the client app', async () => {
    const { session, calls } = makeSession([initFrame, resultFrame]);
    await session.send('hi', 'turn-1', 'quick');
    await new Promise((r) => setTimeout(r, 10));
    const env = calls[0].options.env as Record<string, string>;
    expect(env.PATH).toBe(process.env.PATH);
    expect(env.CLAUDE_AGENT_SDK_CLIENT_APP).toMatch(/fanzitong-agent/);
    await session.close('test');
  });

  it('splits the system prompt at the cache boundary', async () => {
    const { sdk, calls } = fakeSdk([initFrame, resultFrame]);
    const session = new AgentSession(
      'conv-2',
      { sdk, config, log, facts: { localDate: '2026-09-06', deckSize: 88 } },
      () => {},
    );
    session.attach(() => {});
    await session.send('hi', 'turn-1', 'quick');
    await new Promise((r) => setTimeout(r, 10));
    const prompt = calls[0].options.systemPrompt as string[];
    expect(prompt).toHaveLength(3);
    expect(prompt[1]).toBe('__BOUNDARY__');
    expect(prompt[2]).toContain('2026-09-06');
    expect(prompt[0]).toContain('Traditional');
    await session.close('test');
  });

  it('streams text and reports cost and timing when the turn ends', async () => {
    const { session, frames } = makeSession([initFrame, textFrame, resultFrame]);
    await session.send('hi', 'turn-1', 'quick');
    await new Promise((r) => setTimeout(r, 20));
    expect(frames.map((f) => f.type)).toEqual(
      expect.arrayContaining(['turn_started', 'delta', 'result']),
    );
    const result = frames.find((f) => f.type === 'result') as { costUsd: number; ok: boolean };
    expect(result.ok).toBe(true);
    expect(result.costUsd).toBe(0.01);
    await session.close('test');
  });

  it('numbers frames and replays what a reconnecting client missed', async () => {
    const { session, frames } = makeSession([initFrame, textFrame, resultFrame]);
    await session.send('hi', 'turn-1', 'quick');
    await new Promise((r) => setTimeout(r, 20));
    const seen = frames.length;
    expect(seen).toBeGreaterThan(1);

    session.detach();
    const replayed: ServerFrame[] = [];
    const { replayedFrom } = session.attach((f) => replayed.push(f), 1);
    expect(replayedFrom).toBe(1);
    expect(replayed.every((f) => f.seq > 1)).toBe(true);
    expect(replayed).toHaveLength(seen - 1);
    await session.close('test');
  });

  it('reuses one subprocess for a second turn', async () => {
    const { session, calls } = makeSession([initFrame, resultFrame]);
    await session.send('first', 'turn-1', 'quick');
    await new Promise((r) => setTimeout(r, 20));
    await session.send('second', 'turn-2', 'quick');
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toHaveLength(1);
    expect(calls[0].inputs).toHaveLength(2);
    await session.close('test');
  });

  it('surfaces a rate limit as a notice the app can show', async () => {
    const { session, frames } = makeSession([
      initFrame,
      { type: 'system', subtype: 'rate_limit_event' },
      resultFrame,
    ]);
    await session.send('hi', 'turn-1', 'quick');
    await new Promise((r) => setTimeout(r, 20));
    const notice = frames.find((f) => f.type === 'notice') as { text: string } | undefined;
    expect(notice?.text).toMatch(/rate limiting/);
    await session.close('test');
  });

  it('reports a failed turn instead of dying silently', async () => {
    const { sdk } = fakeSdk([]);
    const boom: SdkApi = {
      ...sdk,
      query: (() => {
        const iterator = (async function* () {
          yield initFrame;
          throw new Error('subprocess exited');
        })();
        return Object.assign(iterator, {
          interrupt: async () => undefined,
          setModel: async () => undefined,
          return: async () => ({ done: true, value: undefined }),
        }) as never;
      }) as SdkApi['query'],
    };
    const frames: ServerFrame[] = [];
    const session = new AgentSession('conv-3', { sdk: boom, config, log, facts: {} }, () => {});
    session.attach((f) => frames.push(f));
    await session.send('hi', 'turn-1', 'quick');
    await new Promise((r) => setTimeout(r, 20));
    const result = frames.find((f) => f.type === 'result') as { ok: boolean; error: string };
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/subprocess exited/);
    await session.close('test');
  });
});
