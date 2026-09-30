import {
  CardState,
  isReadingExercise,
  type RatingGrade,
  type ReviewLog,
  type VocabCard,
} from '@/types';
import { DAY_START_HOUR, dayKey } from '@/lib/util/time';

/**
 * Difficulty at or above which a word rated Hard day after day is in a Hard
 * loop: FSRS-6 has almost no verdict left to give it, so the intervals stop
 * growing, and the word never lapses — it is read, slowly, every few days
 * for good. One export held fifteen such words that neither lapses nor slip
 * days caught, the worst rated Hard twenty times over eight days.
 */
export const HARD_LOOP_DIFFICULTY = 9;

/** What one card's trouble is counted in. */
export type TroubleCard = Pick<VocabCard, 'fsrs' | 'slipDays' | 'hardDays'>;

/**
 * A word keeps slipping when it has been forgotten on this many study days
 * (`slipDays`), has this many FSRS lapses, or has been rated Hard on this
 * many days at the top of the difficulty scale — whichever the history
 * shows. FSRS counts a lapse only when a word in Review is forgotten; the
 * words that fail day after day before they ever graduate never reach that
 * count, and the words read slowly every few days at the ceiling never fail.
 */
export function isLeech(card: TroubleCard, threshold: number): boolean {
  return (
    card.fsrs.lapses >= threshold ||
    (card.slipDays ?? 0) >= threshold ||
    isHardLoop(card, threshold)
  );
}

/** Rated Hard on the threshold number of days, at a difficulty that cannot rise further. */
export function isHardLoop(card: TroubleCard, threshold: number): boolean {
  return card.fsrs.difficulty >= HARD_LOOP_DIFFICULTY && (card.hardDays ?? 0) >= threshold;
}

/** How much trouble a word has been: days forgotten, lapses, or days hard at the ceiling, whichever is most. */
export function troubleScore(card: TroubleCard): number {
  const hard = card.fsrs.difficulty >= HARD_LOOP_DIFFICULTY ? (card.hardDays ?? 0) : 0;
  return Math.max(card.fsrs.lapses, card.slipDays ?? 0, hard);
}

/** The count that put the word on the list, in words: "forgotten 3×", "slipped 4 days", "Hard on 5 days". */
export function troubleLabel(card: TroubleCard): string {
  const slips = card.slipDays ?? 0;
  const hard = card.fsrs.difficulty >= HARD_LOOP_DIFFICULTY ? (card.hardDays ?? 0) : 0;
  if (hard > 0 && hard >= slips && hard >= card.fsrs.lapses) {
    return `Hard on ${hard} day${hard === 1 ? '' : 's'}`;
  }
  if (slips > 0 && slips >= card.fsrs.lapses)
    return `slipped ${slips} day${slips === 1 ? '' : 's'}`;
  return `forgotten ${card.fsrs.lapses}×`;
}

/**
 * Count, for each card, the distinct study days on which a reading was rated
 * this way and reached the scheduler, not counting the day the word was
 * first seen. A log with no `stateBefore` predates that field and is
 * counted; a log from before the card was started over is not the card's
 * any more (`restartedAt`).
 */
function countRatingDays(
  logs: readonly ReviewLog[],
  rating: RatingGrade,
  dayStartHour: number,
  restartedAt?: ReadonlyMap<string, string>,
): Map<string, number> {
  const days = new Map<string, Set<string>>();
  for (const log of logs) {
    if (log.rating !== rating || !isReadingExercise(log.exerciseType)) continue;
    if (log.stateBefore === CardState.New) continue;
    const since = restartedAt?.get(log.cardId);
    if (since && log.reviewTimestamp < since) continue;
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

/**
 * Count each card's slip days from its review log: the distinct study days
 * with a reading Again that reached the scheduler, after the word's first
 * sight (a first sight fails for more than half of a heritage reader's new
 * words, and that is not slipping).
 */
export function countSlipDays(
  logs: readonly ReviewLog[],
  dayStartHour: number = DAY_START_HOUR,
  restartedAt?: ReadonlyMap<string, string>,
): Map<string, number> {
  return countRatingDays(logs, 1, dayStartHour, restartedAt);
}

/** Count each card's hard days from its review log, the same way. */
export function countHardDays(
  logs: readonly ReviewLog[],
  dayStartHour: number = DAY_START_HOUR,
  restartedAt?: ReadonlyMap<string, string>,
): Map<string, number> {
  return countRatingDays(logs, 2, dayStartHour, restartedAt);
}

/** When each card was started over, for the counts that read the log from there. */
export function restartsOf(
  cards: readonly Pick<VocabCard, 'id' | 'restartedAt'>[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const card of cards) if (card.restartedAt) out.set(card.id, card.restartedAt);
  return out;
}
