import { useCallback, useState, useSyncExternalStore } from 'react';
import { repository } from '@/db/repository';
import type {
  DrillOutcome,
  EngineSnapshot,
  PersistedReview,
  StudyEngine,
} from '@/lib/session/engine';
import type { RatingGrade } from '@/types';

export interface StudyEngineApi {
  snapshot: EngineSnapshot | null;
  reveal: () => void;
  rate: (rating: RatingGrade) => void;
  answerDrill: (outcomes: DrillOutcome[]) => void;
  skipDrill: () => void;
  finish: () => void;
  saveError: string | null;
}

const noopSubscribe = () => () => undefined;
const getNull = () => null;

/**
 * Binds a StudyEngine (an external store) to React and persists every
 * answer. Writes are not awaited so the UI advances immediately (<50ms budget).
 */
export function useStudyEngine(engine: StudyEngine | null): StudyEngineApi {
  const snapshot = useSyncExternalStore(
    engine ? engine.subscribe : noopSubscribe,
    engine ? engine.snapshot : getNull,
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const persist = useCallback((reviews: PersistedReview[]) => {
    for (const review of reviews) {
      repository.recordReview(review.card, review.log).catch((err: unknown) => {
        console.error('Failed to save review', err);
        setSaveError((err as Error).message);
      });
    }
  }, []);

  const reveal = useCallback(() => engine?.reveal(), [engine]);
  const rate = useCallback(
    (rating: RatingGrade) => {
      if (engine) persist([engine.rate(rating)]);
    },
    [engine, persist],
  );
  const answerDrill = useCallback(
    (outcomes: DrillOutcome[]) => {
      if (engine) persist(engine.answerDrill(outcomes));
    },
    [engine, persist],
  );
  const skipDrill = useCallback(() => engine?.skipDrill(), [engine]);
  const finish = useCallback(() => engine?.finish(), [engine]);

  return { snapshot, reveal, rate, answerDrill, skipDrill, finish, saveError };
}
