import {
  CardState,
  type DomainCategory,
  type ExerciseType,
  type UserSettings,
  type VocabCard,
} from '@/types';
import { MINUTE_MS } from '@/lib/util/time';

/** Cards still in (re)learning that are due within this window are re-shown in the same session. */
export const LEARN_AHEAD_MS = 20 * MINUTE_MS;
/** A contextual drill is interleaved after every Nth answered card. */
export const DRILL_EVERY_N_CARDS = 5;
/**
 * How many times one card may be re-queued inside a single session.
 *
 * A card the learner keeps failing has its interval driven to the FSRS floor
 * (minutes), which is always inside the learn-ahead window, so without a cap
 * it comes straight back — forever. Real sessions have shown one word take
 * fifteen turns in ninety seconds and end the session on its own. After the
 * cap the card is left for the next session, where sleep has had a say.
 */
export const MAX_SESSION_REQUEUES = 3;

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
 * ordered by due date, then new cards in creation order but round-robined
 * across the active domains, both capped by the daily limits remaining today.
 */
export function buildSessionQueue(input: SessionPlanInput): SessionPlan {
  const { cards, settings, now } = input;
  const nowMs = now.getTime();
  const active = cards.filter((c) => isActiveDomain(c, settings));

  const due = active
    .filter((c) => c.fsrs.state !== CardState.New && new Date(c.fsrs.due).getTime() <= nowMs)
    .sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime());

  const fresh = interleaveByDomain(
    active
      .filter((c) => c.fsrs.state === CardState.New)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
          a.traditional.localeCompare(b.traditional, 'zh-Hant-TW'),
      ),
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

/**
 * Round-robin new cards across the domains that still have them, keeping each
 * domain's own order.
 *
 * The deck is authored in blocks — the current starter deck runs 554 food
 * cards before the first church card — so introducing new cards in creation
 * order alone means a learner with four domains switched on can study for
 * weeks and never be shown three of them.
 */
export function interleaveByDomain(cards: VocabCard[]): VocabCard[] {
  const byDomain = new Map<DomainCategory, VocabCard[]>();
  for (const card of cards) {
    const bucket = byDomain.get(card.domain);
    if (bucket) bucket.push(card);
    else byDomain.set(card.domain, [card]);
  }
  if (byDomain.size < 2) return cards;
  // Domains take their turn in the order the deck first offers them.
  const queues = Array.from(byDomain.values());
  const out: VocabCard[] = [];
  for (let round = 0; out.length < cards.length; round += 1) {
    for (const queue of queues) {
      const card = queue[round];
      if (card) out.push(card);
    }
  }
  return out;
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
  exclude: ExerciseType[] = [],
): Exclude<ExerciseType, 'rapid_recognition'> | null {
  const options: Exclude<ExerciseType, 'rapid_recognition'>[] = [];
  if (hasClozeSentence(card) && !exclude.includes('cloze')) options.push('cloze');
  if (card.domain === 'food' && !exclude.includes('realia_menu')) options.push('realia_menu');
  if (hasFoils(card) && !exclude.includes('foil_discrimination'))
    options.push('foil_discrimination');
  if (options.length === 0) return null;
  const rotated = options.filter((t) => t !== lastType);
  return (rotated.length > 0 ? rotated : options)[0];
}
