import { describeDrillOutcome } from '@/lib/session/engine';
import type { VocabCard } from '@/types';

/** One line telling the learner what the answer just did to the schedule. */
export function DrillOutcome({
  card,
  correct,
  applyRating = true,
  reading = false,
}: {
  card: VocabCard | undefined;
  correct: boolean;
  applyRating?: boolean;
  /** The drill was a reading (Say It), which may move a word in Review. */
  reading?: boolean;
}) {
  if (!card) return null;
  return (
    <p className="text-xs text-stone-500 dark:text-stone-400" data-testid="drill-outcome">
      {describeDrillOutcome(card, correct, applyRating, new Date(), { reading })}
    </p>
  );
}
