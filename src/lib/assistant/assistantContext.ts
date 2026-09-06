/**
 * The assistant context.
 *
 * Split from the provider so React Fast Refresh stays happy, and given a real
 * no-op default so every consumer renders without a provider: the study and
 * drill routes, and every component test.
 */
import { createContext, useContext } from 'react';
import type { ProfileName } from './profiles';
import type { AssistantState } from './store';
import { initialState } from './store';
import type { AssistantContext as StudyContext } from './executor';

export interface AskOptions {
  profile?: ProfileName;
  label?: string;
  images?: { mediaType: string; data: string }[];
  /** Open the panel so the learner sees the reply arrive. */
  open?: boolean;
}

export interface AssistantApi {
  state: AssistantState;
  /** False when nothing is configured, or while a study card is still hidden. */
  available: boolean;
  ask: (text: string, options?: AskOptions) => void;
  interrupt: () => void;
  newConversation: () => void;
  setOpen: (open: boolean) => void;
  undo: (batchId: string) => Promise<void>;
  /** Pages tell the assistant what is on screen; the AC-2 gate lives here. */
  publishContext: (context: StudyContext | null) => void;
  reconnect: () => void;
}

export const NO_ASSISTANT: AssistantApi = {
  state: initialState,
  available: false,
  ask: () => undefined,
  interrupt: () => undefined,
  newConversation: () => undefined,
  setOpen: () => undefined,
  undo: async () => undefined,
  publishContext: () => undefined,
  reconnect: () => undefined,
};

export const AssistantContext = createContext<AssistantApi>(NO_ASSISTANT);

export function useAssistant(): AssistantApi {
  return useContext(AssistantContext);
}
