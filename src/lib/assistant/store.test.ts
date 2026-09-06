import { addUserTurn, applyFrame, initialState, settleStep, type AssistantState } from './store';
import type { ServerFrame } from './protocol';

const welcome = {
  type: 'welcome',
  seq: 1,
  protocolVersion: 1,
  conversationId: 'c1',
  replayedFrom: null,
  sidecar: { version: '1.0.0', account: { email: 'me@example.com' }, authState: 'ok' },
} as ServerFrame;

function play(frames: ServerFrame[], from: AssistantState = initialState): AssistantState {
  return frames.reduce(applyFrame, from);
}

describe('assistant store', () => {
  it('connects and remembers the account', () => {
    const state = play([welcome]);
    expect(state.connection).toBe('connected');
    expect(state.account?.email).toBe('me@example.com');
    expect(state.conversationId).toBe('c1');
  });

  it('says so when the sidecar is up but not signed in', () => {
    const state = play([
      {
        ...welcome,
        sidecar: { version: '1.0.0', account: null, authState: 'needs_login' },
      } as ServerFrame,
    ]);
    expect(state.connection).toBe('error');
    expect(state.connectionDetail).toMatch(/not signed in/);
  });

  it('builds one assistant message out of streamed deltas', () => {
    const state = play([
      welcome,
      { type: 'turn_started', seq: 2, conversationId: 'c1' } as ServerFrame,
      { type: 'delta', seq: 3, text: 'Wrote ' } as ServerFrame,
      { type: 'delta', seq: 4, text: 'a sentence.' } as ServerFrame,
    ]);
    const last = state.transcript.at(-1);
    expect(last).toMatchObject({ kind: 'assistant', text: 'Wrote a sentence.', streaming: true });
    expect(state.busy).toBe(true);
  });

  it('shows tool activity and settles it when the turn finishes', () => {
    let state = play([
      welcome,
      { type: 'turn_started', seq: 2, conversationId: 'c1' } as ServerFrame,
      {
        type: 'tool_started',
        seq: 3,
        callId: 't1',
        tool: 'mcp__fanzitong__deck_upsert_cards',
      } as ServerFrame,
    ]);
    let assistant = state.transcript.at(-1) as { steps: { status: string }[] };
    expect(assistant.steps[0].status).toBe('running');

    state = settleStep(state, 'deck_upsert_cards', '1 added', ['batch-1'], false);
    assistant = state.transcript.at(-1) as { steps: { status: string; summary?: string }[] };
    expect(assistant.steps[0]).toMatchObject({ status: 'done', summary: '1 added' });

    state = applyFrame(state, {
      type: 'result',
      seq: 4,
      ok: true,
      text: 'Added 珍珠奶茶.',
      costUsd: 0.02,
    } as ServerFrame);
    expect(state.busy).toBe(false);
    expect(state.costUsd).toBe(0.02);
  });

  it('turns a failed turn into a notice the learner can read', () => {
    const state = play([
      welcome,
      { type: 'turn_started', seq: 2, conversationId: 'c1' } as ServerFrame,
      { type: 'result', seq: 3, ok: false, error: 'error_max_turns' } as ServerFrame,
    ]);
    expect(state.transcript.at(-1)).toMatchObject({ kind: 'notice', level: 'error' });
    expect(state.busy).toBe(false);
  });

  it('keeps thinking summaries out of the transcript', () => {
    const state = play([
      welcome,
      { type: 'turn_started', seq: 2, conversationId: 'c1' } as ServerFrame,
      { type: 'thinking', seq: 3, text: 'Checking the deck for 珍珠奶茶' } as ServerFrame,
    ]);
    expect(state.activity).toMatch(/珍珠奶茶/);
    expect(state.transcript.some((i) => i.kind === 'assistant')).toBe(false);
  });

  it('records the learner’s own turn immediately', () => {
    const state = addUserTurn(initialState, 'turn-1', 'add ten drinks', '滷肉飯');
    expect(state.transcript[0]).toMatchObject({ kind: 'user', text: 'add ten drinks' });
    expect(state.busy).toBe(true);
  });

  it('tracks the highest sequence number for replay', () => {
    const state = play([welcome, { type: 'delta', seq: 9, text: 'x' } as ServerFrame]);
    expect(state.lastSeq).toBe(9);
  });
});
