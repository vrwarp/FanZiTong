import {
  CardState,
  type DomainCategory,
  type ExerciseType,
  type RatingGrade,
  type UserSettings,
  type VocabCard,
} from '@/types';
import { DAY_START_HOUR, isSameLocalDay, MINUTE_MS } from '@/lib/util/time';

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
/**
 * A card is not shown again within this long of its last answer.
 *
 * The reveal puts the reading on screen; asked again seconds later, the
 * learner recites the screen rather than reads the characters, and a pass
 * earned that way walks the card up its learning steps on no evidence. One
 * minute is also what the Again button promises. When nothing else is ready
 * the session waits it out rather than serve the card early.
 */
export const MIN_RETRY_GAP_MS = MINUTE_MS;
/**
 * Stability (days) below which a word is still "settling": the scheduler is
 * bringing it back within a day, so it has not yet shown a next-day recall.
 */
export const SETTLING_STABILITY_DAYS = 1;

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
  /** Studied words the scheduler is still bringing back within a day (active domains). */
  settlingCount: number;
  /** New cards the daily limit allowed but the settling hold kept back today. */
  newCardsHeldBack: number;
}

export function isActiveDomain(card: VocabCard, settings: UserSettings): boolean {
  return settings.activeDomains.includes(card.domain);
}

/** A studied word the scheduler is still bringing back within a day. */
export function isSettling(card: VocabCard): boolean {
  return card.fsrs.state !== CardState.New && card.fsrs.stability < SETTLING_STABILITY_DAYS;
}

/**
 * How many new cards the settling hold leaves room for. Unbounded when the
 * hold is off (0): the daily limit is then the only cap.
 */
export function newCardCapacity(
  settings: Pick<UserSettings, 'maxSettlingCards'>,
  settlingCount: number,
): number {
  if (settings.maxSettlingCards <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, settings.maxSettlingCards - settlingCount);
}

/**
 * Build the daily study queue (PRD Journey 1, step 3): due FSRS reviews first,
 * ordered by due date, then new cards in creation order but round-robined
 * across the active domains, both capped by the daily limits remaining today.
 *
 * New cards are also held back while too many studied words are still
 * settling. A heritage reader meets a never-seen word by failing it, so
 * every new word is a day or three of retries before it sticks; twenty a day
 * on top of yesterday's twenty is how retention slides while the learner is
 * doing everything asked of them. The hold is the app's version of the rule
 * every spaced-repetition community arrives at: no new material while the
 * pile of not-yet-learned material is high.
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
  const dailyNewBudget = Math.max(0, settings.maxDailyNewCards - input.newCardsIntroducedToday);
  const settlingCount = active.filter(isSettling).length;
  const newBudget = Math.min(dailyNewBudget, newCardCapacity(settings, settlingCount));

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
    settlingCount,
    newCardsHeldBack: Math.max(0, Math.min(dailyNewBudget, fresh.length) - newSlice.length),
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

/** Whether the scheduler has already heard "Again" for this card today (study day). */
export function knockedDownToday(
  card: Pick<VocabCard, 'lastAgainAt'>,
  now: Date,
  dayStartHour: number = DAY_START_HOUR,
): boolean {
  return (
    Boolean(card.lastAgainAt) && isSameLocalDay(new Date(card.lastAgainAt!), now, dayStartHour)
  );
}

/** Whether the scheduler has already heard a recognition pass for this card today. */
export function readToday(
  card: Pick<VocabCard, 'lastPassAt'>,
  now: Date,
  dayStartHour: number = DAY_START_HOUR,
): boolean {
  return Boolean(card.lastPassAt) && isSameLocalDay(new Date(card.lastPassAt!), now, dayStartHour);
}

/**
 * A word is knocked down at most once a day.
 *
 * The first Again tells the scheduler what it needs: stability falls,
 * difficulty rises, the word goes back to its first step. Failing it again
 * ten minutes later, after five other new words, says nothing more about the
 * word — it says the learner has not slept on it yet — but FSRS-6 treats
 * every same-day Again as a fresh verdict, multiplying stability by ~0.4 and
 * pushing difficulty toward 10 each time. Three misses in three minutes on a
 * never-seen word left cards pinned at maximum difficulty for good. So after
 * the first Again of the day, further Again/Hard answers are retries: the
 * word comes back, but the scheduler is not consulted. A pass always counts,
 * because that is how the word climbs back out of its step.
 */
export function isRetry(
  card: Pick<VocabCard, 'lastAgainAt'>,
  rating: RatingGrade,
  now: Date,
  dayStartHour: number = DAY_START_HOUR,
): boolean {
  return rating <= 2 && knockedDownToday(card, now, dayStartHour);
}

/**
 * What a drill answer is allowed to do to the schedule.
 *
 * - `again` / `good`: the answer reaches the scheduler as that rating.
 * - `unchanged`: a hit on a word in Review — recorded, nothing to change.
 * - `practice`: the word already had its verdict today (knocked down, or read
 *   correctly in recognition); recorded, the word comes back, the scheduler
 *   is not consulted.
 * - `book`: a miss on a word in Review. A word in Review is moved only by
 *   reading: the miss is recorded and books a recognition look, and how that
 *   look is rated is what the scheduler hears.
 *
 * Why the last two. Drills are four-tile recognition with a guess floor, so
 * a hit was never allowed to move a Review card; a miss was charged as a full
 * lapse. Six days of one learner's data showed every drill lapse landing on a
 * word the learner had read correctly the same day, or would read correctly
 * within two minutes — a discrimination slip, not a forgetting — and those
 * lapses alone pinned words at maximum difficulty. A forced-choice miss is
 * information about the shape, which is what the drills are for, but the
 * memory FSRS models is the one the reading tests.
 */
export type DrillVerdict = 'again' | 'good' | 'unchanged' | 'practice' | 'book';

export function drillVerdict(
  card: Pick<VocabCard, 'fsrs' | 'lastAgainAt' | 'lastPassAt'>,
  correct: boolean,
  now: Date,
  dayStartHour: number = DAY_START_HOUR,
): DrillVerdict {
  if (knockedDownToday(card, now, dayStartHour)) return 'practice';
  if (card.fsrs.state === CardState.Review) return correct ? 'unchanged' : 'book';
  if (readToday(card, now, dayStartHour)) return 'practice';
  return correct ? 'good' : 'again';
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
  const authored = [...(card.homophoneFoils ?? []), ...(card.visualFoils ?? [])];
  return authored.some((f) => f.trim().length > 0);
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
