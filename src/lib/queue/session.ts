import { CardState, type ExerciseType, type UserSettings, type VocabCard } from '@/types';
import { MINUTE_MS } from '@/lib/util/time';

/** Cards still in (re)learning that are due within this window are re-shown in the same session. */
export const LEARN_AHEAD_MS = 20 * MINUTE_MS;
/** A contextual drill is interleaved after every Nth answered card. */
export const DRILL_EVERY_N_CARDS = 5;

export const SECONDS_PER_REVIEW = 30;
export const SECONDS_PER_NEW_CARD = 45;

export interface SessionPlanInput {
  cards: VocabCard[];
  settings: UserSettings;
  now: Date;
  /** Number of review-state cards already answered today (counts against maxDailyReviews). */
  reviewsDoneToday: number;
  /** Number of cards first introduced today (counts against maxDailyNewCards). */
  newCardsIntroducedToday: number;
}

export interface SessionPlan {
  /** Ordered card ids: due reviews first, then new cards. */
  queue: string[];
  dueReviewCount: number;
  newCardCount: number;
  /** Total due reviews regardless of the daily cap. */
  totalDueCount: number;
  /** Total new cards available regardless of the daily cap. */
  totalNewCount: number;
  estimatedMinutes: number;
}

export function isActiveDomain(card: VocabCard, settings: UserSettings): boolean {
  return settings.activeDomains.includes(card.domain);
}

/**
 * Build the daily study queue (PRD Journey 1, step 3): due FSRS reviews first,
 * ordered by due date, then new cards in creation order, both capped by the
 * daily limits remaining for today.
 */
export function buildSessionQueue(input: SessionPlanInput): SessionPlan {
  const { cards, settings, now } = input;
  const nowMs = now.getTime();
  const active = cards.filter((c) => isActiveDomain(c, settings));

  const due = active
    .filter((c) => c.fsrs.state !== CardState.New && new Date(c.fsrs.due).getTime() <= nowMs)
    .sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime());

  const fresh = active
    .filter((c) => c.fsrs.state === CardState.New)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        a.traditional.localeCompare(b.traditional, 'zh-Hant-TW'),
    );

  const reviewBudget = Math.max(0, settings.maxDailyReviews - input.reviewsDoneToday);
  const newBudget = Math.max(0, settings.maxDailyNewCards - input.newCardsIntroducedToday);

  const dueSlice = due.slice(0, reviewBudget);
  const newSlice = fresh.slice(0, newBudget);

  const estimatedSeconds =
    dueSlice.length * SECONDS_PER_REVIEW + newSlice.length * SECONDS_PER_NEW_CARD;

  return {
    queue: [...dueSlice.map((c) => c.id), ...newSlice.map((c) => c.id)],
    dueReviewCount: dueSlice.length,
    newCardCount: newSlice.length,
    totalDueCount: due.length,
    totalNewCount: fresh.length,
    estimatedMinutes: Math.max(1, Math.round(estimatedSeconds / 60)),
  };
}

/** Whether a rated card should be re-queued within the current session. */
export function shouldRequeue(nextDueIso: string, now: Date): boolean {
  return new Date(nextDueIso).getTime() <= now.getTime() + LEARN_AHEAD_MS;
}

/** Cards eligible for a contextual drill: in Learning/Relearning, or with lapses. */
export function isDrillCandidate(card: VocabCard): boolean {
  return (
    card.fsrs.state === CardState.Learning ||
    card.fsrs.state === CardState.Relearning ||
    card.fsrs.lapses > 0
  );
}

export function hasClozeSentence(card: VocabCard): boolean {
  const s = card.exampleSentenceTraditional?.trim();
  return Boolean(s && card.traditional && s.includes(card.traditional));
}

export function hasFoils(card: VocabCard): boolean {
  return Boolean(card.visualFoils && card.visualFoils.filter((f) => f.trim()).length > 0);
}

/**
 * Choose the drill modality for a card, rotating away from the previous type
 * for variety. Returns null when no modality fits the card's data.
 */
export function chooseDrillType(
  card: VocabCard,
  lastType: ExerciseType | undefined,
): Exclude<ExerciseType, 'rapid_recognition'> | null {
  const options: Exclude<ExerciseType, 'rapid_recognition'>[] = [];
  if (hasClozeSentence(card)) options.push('cloze');
  if (card.domain === 'food') options.push('realia_menu');
  if (hasFoils(card)) options.push('foil_discrimination');
  if (options.length === 0) return null;
  const rotated = options.filter((t) => t !== lastType);
  return (rotated.length > 0 ? rotated : options)[0];
}
