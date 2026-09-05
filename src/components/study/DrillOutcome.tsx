import { describeDrillOutcome } from '@/lib/session/engine';
import type { VocabCard } from '@/types';

/** One line telling the learner what the answer just did to the schedule. */
export function DrillOutcome({ card, correct }: { card: VocabCard | undefined; correct: boolean }) {
  if (!card) return null;
  return (
    <p className="text-xs text-stone-500 dark:text-stone-400" data-testid="drill-outcome">
      {describeDrillOutcome(card, correct)}
    </p>
  );
}
