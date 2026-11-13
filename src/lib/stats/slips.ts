import {
  CardState,
  isReadingExercise,
  type RatingGrade,
  type ReviewLog,
  type VocabCard,
} from '@/types';
import { DAY_MS, DAY_START_HOUR, dayKey } from '@/lib/util/time';

/**
 * How far back trouble is counted. Slip days and hard days are the study
 * days of the last thirty on which a word was forgotten or read with
 * difficulty, not every such day there has ever been: a lifetime count can
 * only rise, so a word that slipped three times in September was a leech in
 * November with forty passes behind it, a domain's hold on new words (which
 * counts leeches) could not lift by study, and in time every domain froze.
 * One export had 51 words on the list, 40 of them not missed in two weeks,
 * and two domains held for eleven days on their strength.
 */
export const TROUBLE_WINDOW_DAYS = 30;

/** The instant before which a slip or a hard day no longer counts. */
export function troubleWindowStart(now: Date, days: number = TROUBLE_WINDOW_DAYS): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

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
 * A word keeps slipping when, inside the trouble window, it has been
 * forgotten on this many study days (`slipDays`) or rated Hard on this many
 * days at the top of the difficulty scale. FSRS's own lapse counter is not
 * consulted: it is a lifetime count, and every lapse inside the window is a
 * slip day already.
 */
export function isLeech(card: TroubleCard, threshold: number): boolean {
  return (card.slipDays ?? 0) >= threshold || isHardLoop(card, threshold);
}

/** Rated Hard on the threshold number of days, at a difficulty that cannot rise further. */
export function isHardLoop(card: TroubleCard, threshold: number): boolean {
  return card.fsrs.difficulty >= HARD_LOOP_DIFFICULTY && (card.hardDays ?? 0) >= threshold;
}

/** How much trouble a word is in now: days forgotten or days hard at the ceiling in the window, whichever is more. */
export function troubleScore(card: TroubleCard): number {
  const hard = card.fsrs.difficulty >= HARD_LOOP_DIFFICULTY ? (card.hardDays ?? 0) : 0;
  return Math.max(card.slipDays ?? 0, hard);
}

/** The count that put the word on the list, in words: "slipped 4 days", "Hard on 5 days". */
export function troubleLabel(card: TroubleCard): string {
  const slips = card.slipDays ?? 0;
  const hard = card.fsrs.difficulty >= HARD_LOOP_DIFFICULTY ? (card.hardDays ?? 0) : 0;
  if (hard > 0 && hard >= slips) return `Hard on ${hard} day${hard === 1 ? '' : 's'}`;
  return `slipped ${slips} day${slips === 1 ? '' : 's'}`;
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
  windowStart?: string,
): Map<string, number> {
  const days = new Map<string, Set<string>>();
  for (const log of logs) {
    if (log.rating !== rating || !isReadingExercise(log.exerciseType)) continue;
    if (log.stateBefore === CardState.New) continue;
    if (windowStart && log.reviewTimestamp < windowStart) continue;
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
  since?: string,
): Map<string, number> {
  return countRatingDays(logs, 1, dayStartHour, restartedAt, since);
}

/** Count each card's hard days from its review log, the same way. */
export function countHardDays(
  logs: readonly ReviewLog[],
  dayStartHour: number = DAY_START_HOUR,
  restartedAt?: ReadonlyMap<string, string>,
  since?: string,
): Map<string, number> {
  return countRatingDays(logs, 2, dayStartHour, restartedAt, since);
}

/** When each card was started over, for the counts that read the log from there. */
export function restartsOf(
  cards: readonly Pick<VocabCard, 'id' | 'restartedAt'>[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const card of cards) if (card.restartedAt) out.set(card.id, card.restartedAt);
  return out;
}
