import {
  CardState,
  type DomainCategory,
  type ExerciseType,
  type RatingGrade,
  type UserSettings,
  type VocabCard,
} from '@/types';
import { DAY_START_HOUR, isSameLocalDay, MINUTE_MS } from '@/lib/util/time';
import { hanChars } from '@/lib/util/pinyin';
import { alignSentenceReadings } from '@/lib/util/sentenceReadings';
import { ownSentences } from '@/lib/exercises/cloze';
import { hasSoundFamily, type SoundFamilyIndex } from '@/lib/exercises/soundFamily';
import { isLeech, troubleScore } from '@/lib/stats/slips';

export { hasSoundFamily };

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
 * A shape drill — Spot the Character, Find It, the Order Slip, Sound
 * Families — is not put on a card this soon after the card was last looked
 * at in the session.
 *
 * The drills ask a different question from the reveal, which is why they
 * were let through the minute between looks; but a four-tile pick seconds
 * after the reading is answered from the screen, not from the characters.
 * One export had a quarter of its Spot the Character drills inside two
 * minutes of the same word's reading, at 96% correct, against 82% for the
 * drills between two and ten minutes after it.
 */
export const DRILL_AFTER_LOOK_MS = 3 * MINUTE_MS;
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
  /**
   * How many reviews the learner usually does in a day (see
   * `usualDailyReviews` in lib/stats), for telling a backlog from a busy
   * day. Absent until there is a fortnight to judge by: no backlog is called.
   */
  usualDailyReviews?: number;
  /**
   * The learner's own pace, in seconds per queued card (see `paceSecondsPerCard`
   * in lib/stats). Absent until there is history; the fixed guesses stand in.
   */
  secondsPerCard?: number;
}

/** A pile of due reviews too big for one sitting, and how it is being spread. */
export interface Backlog {
  /** Everything that is due. */
  total: number;
  /** How much of it today's session takes. */
  today: number;
  /** Sittings it will take at this rate, today's included. */
  days: number;
}

export interface SessionPlan {
  /** Ordered card ids: due reviews first, then first tests owed, then new cards. */
  queue: string[];
  dueReviewCount: number;
  newCardCount: number;
  /** Words met face up on an earlier day whose first test is owed (see `isAwaitingFirstTest`). */
  firstTestCount: number;
  /** Total due reviews regardless of the daily cap. */
  totalDueCount: number;
  /** Total new cards available regardless of the daily cap. */
  totalNewCount: number;
  estimatedMinutes: number;
  /** Studied words the scheduler is still bringing back within a day (active domains). */
  settlingCount: number;
  /** New cards the daily limit allowed but the settling hold kept back today. */
  newCardsHeldBack: number;
  /**
   * Active domains whose new cards are held back because the domain holds
   * too many leeches (`maxLeechesPerDomain`), with the count; only domains
   * that still have new cards to hold. Empty when the hold is off.
   */
  domainHolds: DomainHold[];
  /** Set when the due pile is being spread over several days rather than served whole. */
  backlog: Backlog | null;
}

export interface DomainHold {
  domain: DomainCategory;
  leeches: number;
  limit: number;
}

/** A word the learner has set aside: dealt by no session, asked by no drill. */
export function isSetAside(card: Pick<VocabCard, 'setAsideAt'>): boolean {
  return Boolean(card.setAsideAt);
}

export function isActiveDomain(card: VocabCard, settings: UserSettings): boolean {
  return settings.activeDomains.includes(card.domain) && !isSetAside(card);
}

/** The tag that marks an everyday word filed under a themed domain. */
export const GENERAL_TAG = 'general';

/**
 * Which queue a new word waits in: its domain's, or the everyday one.
 *
 * Nearly half of what was left of one learner's "anime" deck was tagged
 * `general` — 公司, 孩子, 生日, 請問 — and the same in "slang": 糟糕, 差不多,
 * 怎麼辦. Those are the words a heritage speaker binds fastest, and filed
 * under their domain they waited behind its order and its leech hold. They
 * take turns as a lane of their own, and no domain's hold reaches them.
 */
export type NewCardLane = DomainCategory | typeof GENERAL_TAG;
export function laneOf(card: Pick<VocabCard, 'domain' | 'tags'>): NewCardLane {
  return card.tags.includes(GENERAL_TAG) ? GENERAL_TAG : card.domain;
}

/** How a switched-off topic is written in `mutedTopics`. */
export function topicKey(domain: DomainCategory, tag: string): string {
  return `${domain}:${tag}`;
}

/** Whether a card carries a tag the learner has switched off for its domain. */
export function isMutedTopic(
  card: Pick<VocabCard, 'domain' | 'tags'>,
  settings: Pick<UserSettings, 'mutedTopics'>,
): boolean {
  const muted = settings.mutedTopics ?? [];
  if (muted.length === 0) return false;
  return card.tags.some((tag) => muted.includes(topicKey(card.domain, tag)));
}

/** A tag of a domain's unmet words, for the topic switches in Settings. */
export interface Topic {
  domain: DomainCategory;
  tag: string;
  /** New words in the domain carrying the tag. */
  newCards: number;
  muted: boolean;
}

/** A tag is offered as a topic once this many unmet words carry it. */
export const TOPIC_MIN_CARDS = 5;

/**
 * The topics a domain's unmet words fall into, biggest first: its tags, each
 * with how many new words carry it. The everyday tag is left out — those
 * words have a lane of their own — and so is a tag too small to be a topic.
 */
export function topicsOf(
  cards: readonly VocabCard[],
  domain: DomainCategory,
  settings: Pick<UserSettings, 'mutedTopics'>,
): Topic[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    if (card.domain !== domain || card.fsrs.state !== CardState.New || card.introducedAt) continue;
    for (const tag of card.tags) {
      if (tag !== GENERAL_TAG) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const muted = settings.mutedTopics ?? [];
  return Array.from(counts, ([tag, newCards]) => ({
    domain,
    tag,
    newCards,
    muted: muted.includes(topicKey(domain, tag)),
  }))
    .filter((t) => t.newCards >= TOPIC_MIN_CARDS || t.muted)
    .sort((a, b) => b.newCards - a.newCards || a.tag.localeCompare(b.tag));
}

/**
 * A word met face up on an earlier study day and not yet tested. The day it
 * is met, its looks are practice (see `isLessonLook`); the first rating the
 * scheduler hears is a cold one on a later day, and it is owed — it does not
 * wait for the new-card budget. A word started over is owed the same.
 */
export function isAwaitingFirstTest(
  card: Pick<VocabCard, 'fsrs' | 'introducedAt'>,
  now: Date,
  dayStartHour: number = DAY_START_HOUR,
): boolean {
  return (
    card.fsrs.state === CardState.New &&
    Boolean(card.introducedAt) &&
    !isSameLocalDay(new Date(card.introducedAt!), now, dayStartHour)
  );
}

/**
 * A look at a word on the day it was met face up. The word has never been
 * tested: minutes after the reading was on screen, a pass is a memory of the
 * screen and a miss is a lesson that has not taken yet, and neither is what
 * FSRS's first rating means. One export, 425 such words: the 101 rated Good
 * then Easy in the same sitting were recalled 75% at their first review
 * against 89% predicted; the 91 that failed were seeded at difficulty 6.4,
 * failed again the next day half the time, and 25 of them made up nearly
 * half of the words pinned at maximum difficulty. Words met cold ran above
 * prediction. So these looks are practice, and the first rating the
 * scheduler hears is the next day's cold one.
 */
export function isLessonLook(
  card: Pick<VocabCard, 'fsrs' | 'introducedAt' | 'restartedAt'>,
  now: Date,
  dayStartHour: number = DAY_START_HOUR,
): boolean {
  return (
    card.fsrs.state === CardState.New &&
    !card.restartedAt &&
    Boolean(card.introducedAt) &&
    isSameLocalDay(new Date(card.introducedAt!), now, dayStartHour)
  );
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
 * The active domains whose new cards are on hold: each holds at least
 * `maxLeechesPerDomain` leeches (by the learner's leech threshold) and still
 * has new cards it would otherwise be dealt. Empty when the hold is off (0).
 *
 * The settling hold watches the words of the last day or two. A word that
 * keeps slipping for weeks is in Review on a ten-day interval and passes it
 * unseen, so a domain can go on being dealt its quarter of every day's new
 * cards while its leech list grows. A leech is counted over the last thirty
 * days (`TROUBLE_WINDOW_DAYS`), so the hold lifts as the words stop slipping;
 * words set aside are not counted, and the everyday lane is not held.
 */
export function domainLeechHolds(
  cards: readonly VocabCard[],
  settings: Pick<UserSettings, 'maxLeechesPerDomain' | 'leechThreshold' | 'activeDomains'>,
): DomainHold[] {
  if (settings.maxLeechesPerDomain <= 0) return [];
  const leeches = new Map<DomainCategory, number>();
  const fresh = new Set<DomainCategory>();
  for (const card of cards) {
    if (!settings.activeDomains.includes(card.domain) || isSetAside(card)) continue;
    if (card.fsrs.state === CardState.New) {
      if (laneOf(card) !== GENERAL_TAG) fresh.add(card.domain);
    } else if (isLeech(card, settings.leechThreshold))
      leeches.set(card.domain, (leeches.get(card.domain) ?? 0) + 1);
  }
  return settings.activeDomains
    .filter((d) => fresh.has(d) && (leeches.get(d) ?? 0) >= settings.maxLeechesPerDomain)
    .map((domain) => ({
      domain,
      leeches: leeches.get(domain) ?? 0,
      limit: settings.maxLeechesPerDomain,
    }));
}

/** A due pile is a backlog once it is this many times the usual day's reviews… */
export const BACKLOG_FACTOR = 1.6;
/** …and at least this big. */
export const BACKLOG_MIN_DUE = 40;
/** A catch-up sitting takes this many times the usual day, or a third of the pile if that is more. */
export const BACKLOG_DAILY_FACTOR = 1.25;

/**
 * How much of a due pile today's sitting takes. One missed day put 135 cards
 * in front of one learner at ten to two in the morning; they stopped at 48,
 * and it took three sittings anyway. A pile well past the usual day is
 * spread over a few days instead, the least stable words first, and no new
 * words are dealt until it is gone.
 */
export function planBacklog(totalDue: number, usualDailyReviews?: number): Backlog | null {
  if (!usualDailyReviews || usualDailyReviews <= 0) return null;
  if (totalDue < BACKLOG_MIN_DUE || totalDue <= usualDailyReviews * BACKLOG_FACTOR) return null;
  const today = Math.min(
    totalDue,
    Math.max(Math.ceil(usualDailyReviews * BACKLOG_DAILY_FACTOR), Math.ceil(totalDue / 3)),
  );
  return { total: totalDue, today, days: Math.ceil(totalDue / today) };
}

/**
 * Build the daily study queue (PRD Journey 1, step 3): due FSRS reviews first,
 * ordered by due date, then the first tests owed to words met face up on an
 * earlier day, then new cards, capped by the daily limits remaining today.
 *
 * New cards are held back while too many studied words are still settling,
 * a domain whose leech list has grown past `maxLeechesPerDomain` is dealt
 * none until it shrinks (`domainLeechHolds`), and a word carrying a topic
 * the learner switched off is not dealt. The words the learner asked for
 * (`queuedAt`) come first; the rest take turns by lane (`laneOf`).
 */
export function buildSessionQueue(input: SessionPlanInput): SessionPlan {
  const { cards, settings, now } = input;
  const nowMs = now.getTime();
  const active = cards.filter((c) => isActiveDomain(c, settings));

  const allDue = active
    .filter((c) => c.fsrs.state !== CardState.New && new Date(c.fsrs.due).getTime() <= nowMs)
    .sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime());
  const backlog = planBacklog(allDue.length, input.usualDailyReviews);
  // A backlog is taken least stable first: those are the words a further
  // day's wait costs most. The sitting itself still runs in due order.
  const due = backlog
    ? [...allDue]
        .sort((a, b) => a.fsrs.stability - b.fsrs.stability)
        .slice(0, backlog.today)
        .sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime())
    : allDue;

  const firstTests = active
    .filter((c) => isAwaitingFirstTest(c, now))
    .sort((a, b) => (a.introducedAt ?? '').localeCompare(b.introducedAt ?? ''));

  const domainHolds = domainLeechHolds(active, settings);
  const held = new Set(domainHolds.map((h) => h.domain));
  const untouched = active.filter((c) => c.fsrs.state === CardState.New && !c.introducedAt);
  const inDeckOrder = (a: VocabCard, b: VocabCard) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
    a.traditional.localeCompare(b.traditional, 'zh-Hant-TW');
  const asked = untouched
    .filter((c) => c.queuedAt)
    .sort((a, b) => (a.queuedAt ?? '').localeCompare(b.queuedAt ?? '') || inDeckOrder(a, b));
  const fresh = [
    ...asked,
    ...interleaveByLane(
      untouched
        .filter(
          (c) =>
            !c.queuedAt &&
            !isMutedTopic(c, settings) &&
            (laneOf(c) === GENERAL_TAG || !held.has(c.domain)),
        )
        .sort(inDeckOrder),
    ),
  ];

  const reviewBudget = Math.max(0, settings.maxDailyReviews - input.reviewsDoneToday);
  const dailyNewBudget = Math.max(0, settings.maxDailyNewCards - input.newCardsIntroducedToday);
  const settlingCount = active.filter(isSettling).length;
  const newBudget = backlog
    ? 0
    : Math.min(dailyNewBudget, newCardCapacity(settings, settlingCount));

  const dueSlice = due.slice(0, reviewBudget);
  const newSlice = fresh.slice(0, newBudget);
  if (backlog) backlog.today = dueSlice.length;

  const estimatedSeconds = input.secondsPerCard
    ? (dueSlice.length + firstTests.length + newSlice.length) * input.secondsPerCard
    : (dueSlice.length + firstTests.length) * SECONDS_PER_REVIEW +
      newSlice.length * SECONDS_PER_NEW_CARD;

  return {
    queue: [...dueSlice, ...firstTests, ...newSlice].map((c) => c.id),
    dueReviewCount: dueSlice.length,
    newCardCount: newSlice.length,
    firstTestCount: firstTests.length,
    totalDueCount: allDue.length,
    totalNewCount: fresh.length,
    estimatedMinutes: Math.max(1, Math.round(estimatedSeconds / 60)),
    settlingCount,
    newCardsHeldBack: backlog
      ? 0
      : Math.max(0, Math.min(dailyNewBudget, fresh.length) - newSlice.length),
    domainHolds,
    backlog: backlog && backlog.today > 0 ? backlog : null,
  };
}

/**
 * Round-robin new cards across the lanes that still have them, keeping each
 * lane's own order.
 *
 * The deck is authored in blocks — the current starter deck runs 554 food
 * cards before the first church card — so introducing new cards in creation
 * order alone means a learner with four domains switched on can study for
 * weeks and never be shown three of them.
 */
export function interleaveByLane(cards: VocabCard[]): VocabCard[] {
  const byLane = new Map<NewCardLane, VocabCard[]>();
  for (const card of cards) {
    const lane = laneOf(card);
    const bucket = byLane.get(lane);
    if (bucket) bucket.push(card);
    else byLane.set(lane, [card]);
  }
  if (byLane.size < 2) return cards;
  // Lanes take their turn in the order the deck first offers them.
  const queues = Array.from(byLane.values());
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

/** Whether an optional ISO timestamp falls on the same study day as `now`. */
function stampedToday(stamp: string | undefined, now: Date, dayStartHour: number): boolean {
  return stamp ? isSameLocalDay(new Date(stamp), now, dayStartHour) : false;
}

/** Whether the scheduler has already heard "Again" for this card today (study day). */
export function knockedDownToday(
  card: Pick<VocabCard, 'lastAgainAt'>,
  now: Date,
  dayStartHour: number = DAY_START_HOUR,
): boolean {
  return stampedToday(card.lastAgainAt, now, dayStartHour);
}

/** Whether the scheduler has already heard Hard for this card today (study day). */
export function hardToday(
  card: Pick<VocabCard, 'lastHardAt'>,
  now: Date,
  dayStartHour: number = DAY_START_HOUR,
): boolean {
  return stampedToday(card.lastHardAt, now, dayStartHour);
}

/** Whether the scheduler has already heard a recognition pass for this card today. */
export function readToday(
  card: Pick<VocabCard, 'lastPassAt'>,
  now: Date,
  dayStartHour: number = DAY_START_HOUR,
): boolean {
  return stampedToday(card.lastPassAt, now, dayStartHour);
}

/**
 * A word is knocked down at most once a day, and rated Hard at most once.
 *
 * The first Again tells the scheduler what it needs: stability falls,
 * difficulty rises, the word goes back to its first step. Failing it again
 * ten minutes later, after five other new words, says nothing more about the
 * word — it says the learner has not slept on it yet — but FSRS-6 treats
 * every same-day Again as a fresh verdict, multiplying stability by ~0.4 and
 * pushing difficulty toward 10 each time. Three misses in three minutes on a
 * never-seen word left cards pinned at maximum difficulty for good. So after
 * the first Again of the day, further Again/Hard answers are retries: the
 * word comes back, but the scheduler is not consulted.
 *
 * Hard stacks the same way. A same-day Hard on a word still being learned
 * leaves stability where it is and adds difficulty — more than a point at
 * mid-scale — and a day that opens with Hard had no guard at all: one
 * export held 88 Hards applied to words already rated Hard or Again that
 * day, three of them on one word inside thirteen minutes, and fifteen of
 * the twenty-three words pinned at the ceiling had been pushed there that
 * way. So after the day's first Hard, a further Hard is a retry too. The
 * first Again of the day is still heard after a Hard, because a word read
 * slowly at noon and not at all at ten is a word forgotten. A pass always
 * counts, because that is how the word climbs back out of its step.
 */
export function isRetry(
  card: Pick<VocabCard, 'lastAgainAt' | 'lastHardAt'>,
  rating: RatingGrade,
  now: Date,
  dayStartHour: number = DAY_START_HOUR,
): boolean {
  if (rating >= 3) return false;
  if (knockedDownToday(card, now, dayStartHour)) return true;
  return rating === 2 && hardToday(card, now, dayStartHour);
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

export interface DrillVerdictOptions {
  /**
   * The drill was a reading — the learner produced the word from the
   * characters (Say It) rather than choosing among shapes. A reading is what
   * moves a word in Review, so a hit is Good and a miss Again there too; the
   * day's rules still hold, and a word already read today is practised.
   */
  reading?: boolean;
}

export function drillVerdict(
  card: Pick<VocabCard, 'fsrs' | 'lastAgainAt' | 'lastPassAt'>,
  correct: boolean,
  now: Date,
  dayStartHour: number = DAY_START_HOUR,
  options: DrillVerdictOptions = {},
): DrillVerdict {
  if (knockedDownToday(card, now, dayStartHour)) return 'practice';
  if (options.reading) {
    if (readToday(card, now, dayStartHour)) return 'practice';
    return correct ? 'good' : 'again';
  }
  if (card.fsrs.state === CardState.Review) return correct ? 'unchanged' : 'book';
  if (readToday(card, now, dayStartHour)) return 'practice';
  return correct ? 'good' : 'again';
}

/** Cards eligible for a contextual drill: in Learning/Relearning, or in trouble (lapsed, or forgotten on some day). */
export function isDrillCandidate(card: VocabCard): boolean {
  if (isSetAside(card)) return false;
  return (
    card.fsrs.state === CardState.Learning ||
    card.fsrs.state === CardState.Relearning ||
    troubleScore(card) > 0 ||
    hasRecentMixup(card)
  );
}

/** A wrong shape taken for the word in a drill is remembered this long. */
export const MIXUP_WINDOW_DAYS = 30;

/** Whether a wrong shape was taken for this word lately (`VocabCard.mixups`). */
export function hasRecentMixup(card: Pick<VocabCard, 'mixups'>, now: Date = new Date()): boolean {
  const since = now.getTime() - MIXUP_WINDOW_DAYS * 24 * 60 * MINUTE_MS;
  return (card.mixups ?? []).some((m) => new Date(m.at).getTime() >= since);
}

/**
 * How long a word in Review rests after it was last read correctly before
 * Say It asks it again.
 *
 * A typed reading on a word in Review is a review: it reaches the scheduler
 * and pushes the word's due date out. With no rest, the words at the top of
 * the trouble list were asked every night — one export: 227 Say It answers,
 * two thirds of them on five words, one typed 45 times — and their cards had
 * not come up as cards, or been tested at more than a day's gap, in six
 * weeks. A week is long enough for the next reading to be a retrieval.
 */
export const SAY_IT_REST_DAYS = 7;

/** Whether a word in Review has rested since its last correct reading. */
export function restedForSayIt(card: Pick<VocabCard, 'lastPassAt'>, now: Date): boolean {
  if (!card.lastPassAt) return true;
  return (
    now.getTime() - new Date(card.lastPassAt).getTime() >= SAY_IT_REST_DAYS * 24 * 60 * MINUTE_MS
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

/** Which Word needs a meaning to ask from and a reading to ask about. */
export function hasMeaningCue(card: VocabCard): boolean {
  return card.definition.trim().length > 0 && card.pinyin.trim().length > 0;
}

/** Say It needs a reading to type, and characters to type it from. */
export function hasReading(card: VocabCard): boolean {
  return card.pinyin.trim().length > 0 && hanChars(card.traditional).length > 0;
}

/**
 * Find It cuts a sentence into words by its reading, so it needs one of the
 * card's own sentences whose reading lines up with its characters.
 */
export function hasAlignedSentence(card: VocabCard): boolean {
  return ownSentences(card).some(
    (s) => Boolean(s.pinyin) && alignSentenceReadings(s.traditional, s.pinyin!) !== null,
  );
}

export type DrillType = Exclude<ExerciseType, 'rapid_recognition'>;

/** The drill modalities in the order they take turns. */
export const DRILL_ROTATION: DrillType[] = [
  'cloze',
  'realia_menu',
  'foil_discrimination',
  'meaning_to_form',
  'typed_reading',
  'find_in_text',
  'sound_family',
];

/**
 * The drills that start from what the reveal has just put on screen — the
 * sentence, the meaning, the reading — and so are kept, in a session, for
 * cards not seen that day; on a card revealed minutes ago they would test
 * the memory of the screen.
 */
export const FRESH_CARD_DRILLS: DrillType[] = ['cloze', 'meaning_to_form', 'typed_reading'];

/** What a drill needs beyond the card: the deck's sound families, once the composition table is in. */
export interface DrillContext {
  families?: SoundFamilyIndex | null;
}

/** Whether the card's data can support a drill of this kind. */
export function supportsDrill(card: VocabCard, type: DrillType, ctx: DrillContext = {}): boolean {
  switch (type) {
    case 'cloze':
      return hasClozeSentence(card);
    case 'realia_menu':
      return card.domain === 'food';
    case 'foil_discrimination':
      return hasFoils(card);
    case 'meaning_to_form':
      return hasMeaningCue(card);
    case 'typed_reading':
      return hasReading(card);
    case 'find_in_text':
      return hasAlignedSentence(card);
    case 'sound_family':
      return ctx.families ? hasSoundFamily(card, ctx.families) : false;
  }
}

/**
 * Choose the drill modality for a card: the one after `lastType` in the
 * rotation that the card's data supports, so every kind gets its turn rather
 * than two of them alternating. Returns null when no modality fits the card.
 */
export function chooseDrillType(
  card: VocabCard,
  lastType: ExerciseType | undefined,
  exclude: ExerciseType[] = [],
  ctx: DrillContext = {},
): DrillType | null {
  const options = DRILL_ROTATION.filter((t) => !exclude.includes(t) && supportsDrill(card, t, ctx));
  if (options.length === 0) return null;
  const last = (DRILL_ROTATION as ExerciseType[]).indexOf(lastType ?? 'rapid_recognition');
  const after = options.filter((t) => DRILL_ROTATION.indexOf(t) > last);
  return (after.length > 0 ? after : options)[0];
}
