import { CardState, type ReviewLog, type VocabCard } from '@/types';
import { DAY_START_HOUR, dayKey } from '@/lib/util/time';

/**
 * A word keeps slipping when it has been forgotten on this many study days
 * (`slipDays`) or has this many FSRS lapses — whichever the history shows.
 * FSRS counts a lapse only when a word in Review is forgotten; the words that
 * fail day after day before they ever graduate never reach that count.
 */
export function isLeech(card: Pick<VocabCard, 'fsrs' | 'slipDays'>, threshold: number): boolean {
  return card.fsrs.lapses >= threshold || (card.slipDays ?? 0) >= threshold;
}

/** How much trouble a word has been: days forgotten plus lapses, whichever way they were counted. */
export function troubleScore(card: Pick<VocabCard, 'fsrs' | 'slipDays'>): number {
  return Math.max(card.fsrs.lapses, card.slipDays ?? 0);
}

/**
 * Count each card's slip days from its review log: the distinct study days
 * with a recognition Again that reached the scheduler, not counting the day
 * the word was first seen (a first sight fails for more than half of a
 * heritage reader's new words, and that is not slipping). A log with no
 * `stateBefore` predates that field and is counted.
 */
export function countSlipDays(
  logs: readonly ReviewLog[],
  dayStartHour: number = DAY_START_HOUR,
): Map<string, number> {
  const days = new Map<string, Set<string>>();
  for (const log of logs) {
    if (log.rating !== 1 || log.exerciseType !== 'rapid_recognition') continue;
    if (log.stateBefore === CardState.New) continue;
    let set = days.get(log.cardId);
    if (!set) {
      set = new Set();
      days.set(log.cardId, set);
    }
    set.add(dayKey(new Date(log.reviewTimestamp), dayStartHour));
  }
  const out = new Map<string, number>();
  for (const [cardId, set] of days) out.set(cardId, set.size);
  return out;
}
