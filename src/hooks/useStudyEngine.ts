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
  /** Re-check a waiting session once its gap has passed. */
  tick: () => void;
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

  const persist = useCallback(
    (reviews: PersistedReview[]) => {
      for (const review of reviews) {
        repository.recordReview(review.card, review.log).catch((err: unknown) => {
          console.error('Failed to save review', err);
          setSaveError((err as Error).message);
        });
      }
      // The record of which sentences a card has been shown in changes on a
      // reveal and on a cloze, neither of which need write a review.
      const saved = new Set(reviews.map((r) => r.card.id));
      const touched = (engine?.drainTouchedCards() ?? []).filter((c) => !saved.has(c.id));
      if (touched.length > 0) {
        repository.putCards(touched).catch((err: unknown) => {
          console.error('Failed to save cards', err);
        });
      }
    },
    [engine],
  );

  const reveal = useCallback(() => engine?.reveal(), [engine]);
  const rate = useCallback(
    (rating: RatingGrade) => {
      if (!engine) return;
      // A retry on a word already knocked down today changes nothing to save.
      const review = engine.rate(rating);
      persist(review ? [review] : []);
    },
    [engine, persist],
  );
  const answerDrill = useCallback(
    (outcomes: DrillOutcome[]) => {
      if (engine) persist(engine.answerDrill(outcomes));
    },
    [engine, persist],
  );
  const skipDrill = useCallback(() => {
    engine?.skipDrill();
    persist([]);
  }, [engine, persist]);
  const tick = useCallback(() => engine?.tick(), [engine]);
  const finish = useCallback(() => {
    engine?.finish();
    persist([]);
  }, [engine, persist]);

  return { snapshot, reveal, rate, answerDrill, skipDrill, tick, finish, saveError };
}
