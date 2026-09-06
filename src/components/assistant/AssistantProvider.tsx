import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { repository } from '@/db/repository';
import { AssistantClient } from '@/lib/assistant/client';
import {
  isSecureEndpoint,
  loadConfig,
  loadConversationId,
  parsePairingHash,
  saveConversationId,
  saveEndpoint,
} from '@/lib/assistant/config';
import {
  createToolExecutor,
  type AssistantContext as StudyContext,
} from '@/lib/assistant/executor';
import { describeCounts } from '@/lib/assistant/journal';
import {
  AssistantContext,
  type AskOptions,
  type AssistantApi,
} from '@/lib/assistant/assistantContext';
import {
  addDrill,
  addUserTurn,
  applyFrame,
  initialState,
  settleStep,
  type AssistantState,
} from '@/lib/assistant/store';
import type { ContentBlock } from '@/lib/assistant/protocol';

/**
 * Owns the socket for the whole app.
 *
 * Mounted at the root rather than inside the shell, because a study session is
 * exactly when the assistant is most useful and `/study` renders outside the
 * shell. When nothing is configured this costs one render and no network.
 */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AssistantState>(initialState);
  const clientRef = useRef<AssistantClient | null>(null);
  const contextRef = useRef<StudyContext>({ route: '/' });
  const turnRef = useRef<{ conversationId?: string; turnId?: string }>({});
  // The reading gate has to drive rendering, not just tool answers: a ref would
  // leave the launcher on screen after the next card comes up face down.
  const [studyHidden, setStudyHidden] = useState(false);
  // Pairing may arrive in the URL fragment, so read it before the first render
  // rather than in an effect that would connect twice.
  const [config, setConfig] = useState(() => {
    const pairing = typeof window === 'undefined' ? null : parsePairingHash(window.location.hash);
    if (pairing) saveEndpoint(pairing.endpoint, pairing.token);
    return loadConfig();
  });

  // Strip the pairing fragment so it never sits in the address bar or a
  // screenshot. The value was already taken above.
  useEffect(() => {
    if (!window.location.hash.includes('pair=')) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  const configured = Boolean(config.endpoint) && isSecureEndpoint(config.endpoint);

  useEffect(() => {
    if (!configured) return;
    const executor = createToolExecutor({
      repository,
      getContext: () => contextRef.current,
      getTurn: () => turnRef.current,
    });
    const client = new AssistantClient({
      endpoint: config.endpoint,
      token: config.token,
      buildId: __BUILD_ID__,
      conversationId: loadConversationId(),
      onRpc: async (method, input) => {
        const outcome = await executor.execute(method, input);
        if (outcome.batchIds?.length) {
          // Show what actually changed on the tool row, with an undo.
          const batch = await repository.getAssistantBatch(outcome.batchIds[0]);
          setState((s) =>
            settleStep(
              s,
              method,
              batch ? describeCounts(batch.counts) : 'Done',
              outcome.batchIds ?? [],
              Boolean(outcome.isError),
            ),
          );
        } else {
          setState((s) => settleStep(s, method, 'Done', [], Boolean(outcome.isError)));
        }
        if (method === 'suggest_drill' && !outcome.isError) {
          const drill = outcome.result as { url?: string; label?: string };
          if (drill.url) setState((s) => addDrill(s, drill.label ?? 'Practice', drill.url!));
        }
        return { result: outcome.result, isError: outcome.isError };
      },
      onFrame: (frame) => {
        setState((s) => applyFrame(s, frame));
        if (frame.type === 'welcome') saveConversationId(frame.conversationId);
        if (frame.type === 'turn_started') {
          turnRef.current = { conversationId: frame.conversationId, turnId: frame.turnId };
        }
      },
      onState: (connection, detail) =>
        setState((s) => ({ ...s, connection, connectionDetail: detail })),
    });
    clientRef.current = client;
    client.connect();

    // A phone kills the socket the moment it locks; come back when it wakes.
    const wake = () => {
      if (document.visibilityState === 'visible') client.nudge();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    window.addEventListener('pageshow', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('pageshow', wake);
      client.close();
      clientRef.current = null;
    };
  }, [configured, config.endpoint, config.token]);

  const publishContext = useCallback((context: StudyContext | null) => {
    contextRef.current = context ?? { route: window.location.pathname };
    const hidden = context?.study?.hidden ?? false;
    setStudyHidden(hidden);
    // A card the learner has not revealed must not even reach the panel.
    if (hidden) setState((s) => (s.open ? { ...s, open: false } : s));
  }, []);

  const ask = useCallback((text: string, options: AskOptions = {}) => {
    const client = clientRef.current;
    if (!client) return;
    const content: string | ContentBlock[] = options.images?.length
      ? [
          { type: 'text', text },
          ...options.images.map((image) => ({
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: image.mediaType as 'image/jpeg',
              data: image.data,
            },
          })),
        ]
      : text;
    const turnId = client.ask(content, {
      profile: options.profile,
      label: options.label,
    });
    if (!turnId) return;
    setState((s) => ({
      ...addUserTurn(s, turnId, text, options.label, options.images?.length ?? 0),
      open: options.open ?? s.open,
    }));
  }, []);

  const undo = useCallback(async (batchId: string) => {
    const outcome = await repository.undoAssistantBatch(batchId);
    clientRef.current?.note(
      outcome.error
        ? `The learner tried to undo a change: ${outcome.error}`
        : `The learner undid a change you made (${outcome.restored} card(s) restored). Do not redo it unless they ask.`,
    );
    setState((s) => ({
      ...s,
      transcript: [
        ...s.transcript,
        {
          kind: 'notice',
          id: `undo-${batchId}`,
          level: outcome.error ? 'warning' : 'info',
          text: outcome.error ?? 'Change undone.',
        },
      ],
    }));
  }, []);

  const api = useMemo<AssistantApi>(
    () => ({
      state: configured
        ? state
        : { ...state, connection: 'unconfigured', connectionDetail: undefined },
      available: configured && !studyHidden,
      ask,
      interrupt: () => clientRef.current?.interrupt(),
      newConversation: () => {
        clientRef.current?.newConversation();
        saveConversationId(null);
        setState((s) => ({ ...initialState, connection: s.connection, open: s.open }));
      },
      setOpen: (open) => setState((s) => ({ ...s, open })),
      undo,
      publishContext,
      reconnect: () => {
        setConfig(loadConfig());
        clientRef.current?.nudge();
      },
    }),
    [state, configured, studyHidden, ask, undo, publishContext],
  );

  return <AssistantContext.Provider value={api}>{children}</AssistantContext.Provider>;
}
