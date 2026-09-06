/**
 * The transcript and connection state the panel renders.
 *
 * Written as a reducer over protocol frames so it can be tested without a
 * socket, and exposed as an external store like `settingsStore`.
 */
import type { ServerFrame } from './protocol';
import type { AssistantAccount } from './protocol';

export type ConnectionState =
  'unconfigured' | 'connecting' | 'connected' | 'offline' | 'unauthorized' | 'error';

export interface ToolStep {
  callId: string;
  tool: string;
  status: 'running' | 'done' | 'failed';
  /** What the app actually did, e.g. "1 added". */
  summary?: string;
  /** Set once the change is journaled, so the row can offer an undo. */
  batchIds?: string[];
}

export type TranscriptItem =
  | { kind: 'user'; id: string; text: string; label?: string; images?: number }
  | { kind: 'assistant'; id: string; text: string; streaming: boolean; steps: ToolStep[] }
  | { kind: 'notice'; id: string; level: 'info' | 'warning' | 'error'; text: string }
  | { kind: 'drill'; id: string; label: string; url: string };

export interface AssistantState {
  connection: ConnectionState;
  /** Why the connection is unhappy, in words the learner can act on. */
  connectionDetail?: string;
  account: AssistantAccount | null;
  authState: 'ok' | 'unknown' | 'needs_login';
  conversationId: string | null;
  lastSeq: number;
  transcript: TranscriptItem[];
  /** A turn is in flight. */
  busy: boolean;
  status?: 'thinking' | 'requesting' | 'compacting';
  /** The model's one-line note about what it is doing. */
  activity?: string;
  suggestion?: string;
  costUsd: number;
  open: boolean;
}

export const initialState: AssistantState = {
  connection: 'unconfigured',
  account: null,
  authState: 'unknown',
  conversationId: null,
  lastSeq: 0,
  transcript: [],
  busy: false,
  costUsd: 0,
  open: false,
};

/** Keep the panel from growing without bound on a long day. */
const MAX_ITEMS = 200;

function trim(items: TranscriptItem[]): TranscriptItem[] {
  return items.length > MAX_ITEMS ? items.slice(items.length - MAX_ITEMS) : items;
}

function currentAssistant(state: AssistantState): {
  index: number;
  item: Extract<TranscriptItem, { kind: 'assistant' }>;
} | null {
  for (let i = state.transcript.length - 1; i >= 0; i -= 1) {
    const item = state.transcript[i];
    if (item.kind === 'assistant') return { index: i, item };
    if (item.kind === 'user') return null;
  }
  return null;
}

function withAssistant(
  state: AssistantState,
  update: (
    item: Extract<TranscriptItem, { kind: 'assistant' }>,
  ) => Extract<TranscriptItem, { kind: 'assistant' }>,
  id: string,
): AssistantState {
  const found = currentAssistant(state);
  const transcript = [...state.transcript];
  if (found) {
    transcript[found.index] = update(found.item);
  } else {
    transcript.push(update({ kind: 'assistant', id, text: '', streaming: true, steps: [] }));
  }
  return { ...state, transcript: trim(transcript) };
}

export function applyFrame(state: AssistantState, frame: ServerFrame): AssistantState {
  const next = { ...state, lastSeq: Math.max(state.lastSeq, frame.seq) };

  switch (frame.type) {
    case 'welcome':
      return {
        ...next,
        connection: frame.sidecar.authState === 'needs_login' ? 'error' : 'connected',
        connectionDetail:
          frame.sidecar.authState === 'needs_login'
            ? 'The sidecar is running but not signed in to Claude.'
            : undefined,
        account: frame.sidecar.account,
        authState: frame.sidecar.authState,
        conversationId: frame.conversationId,
        // A replay from an older point means the client already has the rest.
        transcript: frame.replayedFrom === null ? next.transcript : next.transcript,
      };

    case 'turn_started':
      return { ...next, busy: true, activity: undefined };

    case 'delta':
      return withAssistant(
        next,
        (item) => ({ ...item, text: item.text + frame.text, streaming: true }),
        frame.seq.toString(),
      );

    case 'thinking':
      return { ...next, activity: frame.text };

    case 'tool_started':
      return withAssistant(
        next,
        (item) =>
          item.steps.some((s) => s.callId === frame.callId)
            ? item
            : {
                ...item,
                steps: [
                  ...item.steps,
                  { callId: frame.callId, tool: frame.tool, status: 'running' },
                ],
              },
        frame.seq.toString(),
      );

    case 'status':
      if (frame.status === 'idle') return { ...next, busy: false, status: undefined };
      if (frame.status === 'running') return { ...next, busy: true };
      return { ...next, status: frame.status };

    case 'result': {
      const settled = withAssistant(
        next,
        (item) => ({
          ...item,
          text: item.text || frame.text || '',
          streaming: false,
          steps: item.steps.map((step) =>
            step.status === 'running' ? { ...step, status: 'done' } : step,
          ),
        }),
        frame.seq.toString(),
      );
      const transcript = frame.ok
        ? settled.transcript
        : trim([
            ...settled.transcript,
            {
              kind: 'notice' as const,
              id: `err-${frame.seq}`,
              level: 'error' as const,
              text: frame.error ?? 'The assistant could not finish that.',
            },
          ]);
      return {
        ...settled,
        transcript,
        busy: false,
        status: undefined,
        activity: undefined,
        costUsd: frame.costUsd ?? settled.costUsd,
      };
    }

    case 'suggestion':
      return { ...next, suggestion: frame.text };

    case 'notice':
      return {
        ...next,
        transcript: trim([
          ...next.transcript,
          { kind: 'notice', id: `notice-${frame.seq}`, level: frame.level, text: frame.text },
        ]),
      };

    default:
      return next;
  }
}

export function addUserTurn(
  state: AssistantState,
  turnId: string,
  text: string,
  label?: string,
  images = 0,
): AssistantState {
  const item: TranscriptItem = { kind: 'user', id: turnId, text };
  if (label) (item as { label?: string }).label = label;
  if (images) (item as { images?: number }).images = images;
  return {
    ...state,
    transcript: trim([...state.transcript, item]),
    busy: true,
    suggestion: undefined,
  };
}

export function addDrill(state: AssistantState, label: string, url: string): AssistantState {
  return {
    ...state,
    transcript: trim([...state.transcript, { kind: 'drill', id: url, label, url }]),
  };
}

/** Record what a tool call did, so the row can show a summary and an undo. */
export function settleStep(
  state: AssistantState,
  tool: string,
  summary: string,
  batchIds: string[],
  failed: boolean,
): AssistantState {
  const transcript = [...state.transcript];
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    const item = transcript[i];
    if (item.kind !== 'assistant') continue;
    const stepIndex = item.steps.findLastIndex(
      (step) => step.tool.endsWith(tool) && step.status === 'running',
    );
    if (stepIndex === -1) continue;
    const steps = [...item.steps];
    steps[stepIndex] = {
      ...steps[stepIndex],
      status: failed ? 'failed' : 'done',
      summary,
      batchIds,
    };
    transcript[i] = { ...item, steps };
    break;
  }
  return { ...state, transcript };
}
