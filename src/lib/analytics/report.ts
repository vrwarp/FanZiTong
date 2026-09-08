import {
  CardState,
  DOMAIN_CATEGORIES,
  type DomainCategory,
  type ExerciseType,
  type RatingGrade,
  type ReviewLog,
  type UserSettings,
  type VocabCard,
} from '@/types';
import { interleaveByDomain, isActiveDomain, LEARN_AHEAD_MS } from '@/lib/queue/session';
import { MASTERY_STABILITY_DAYS } from '@/lib/stats/analytics';
import { dayKey, MINUTE_MS } from '@/lib/util/time';
import type { StudyEvent } from './events';

/** Bumped whenever the report's shape changes incompatibly. */
export const ANALYTICS_REPORT_VERSION = 1;

/** A quiet stretch longer than this ends an inferred session. */
export const SESSION_GAP_MS = 30 * MINUTE_MS;
/** How many upcoming new cards the domain-order preview looks at. */
export const NEW_QUEUE_PREVIEW = 200;
/** Per-card answer history is capped so one leech cannot dominate the file. */
export const MAX_CARD_HISTORY = 100;
/** An answer faster than this was not a reading. */
export const UNREADABLY_FAST_MS = 800;
/** Difficulty at or above this is saturated: FSRS has no worse rating to give. */
export const DIFFICULTY_SATURATED = 9.5;
/** Stability at or below this (days) means every interval is minutes. */
export const STABILITY_FLOOR_DAYS = 0.05;
/** Answers on one card in one session, above which the session was a loop. */
export const LOOP_ANSWER_THRESHOLD = 6;

export type RatingCounts = Record<RatingGrade, number>;
export type ExerciseCounts = Record<ExerciseType, number>;

const EXERCISES: ExerciseType[] = [
  'rapid_recognition',
  'cloze',
  'realia_menu',
  'foil_discrimination',
];

const STATE_NAMES = ['new', 'learning', 'review', 'relearning', 'unknown'] as const;
export type StateName = (typeof STATE_NAMES)[number];

function stateName(state: number | undefined): StateName {
  switch (state) {
    case CardState.New:
      return 'new';
    case CardState.Learning:
      return 'learning';
    case CardState.Review:
      return 'review';
    case CardState.Relearning:
      return 'relearning';
    default:
      return 'unknown';
  }
}

function emptyRatings(): RatingCounts {
  return { 1: 0, 2: 0, 3: 0, 4: 0 };
}

function emptyExercises(): ExerciseCounts {
  return { rapid_recognition: 0, cloze: 0, realia_menu: 0, foil_discrimination: 0 };
}

export interface Quantiles {
  n: number;
  p50: number | null;
  p90: number | null;
  max: number | null;
}

/** Nearest-rank quantiles; null when there is nothing to summarize. */
export function quantiles(values: number[]): Quantiles {
  if (values.length === 0) return { n: 0, p50: null, p90: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
  return { n: sorted.length, p50: at(0.5), p90: at(0.9), max: sorted[sorted.length - 1] };
}

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

// ---- deck census -----------------------------------------------------

export interface DomainCensus {
  domain: DomainCategory;
  /** Whether the learner currently studies this domain. */
  active: boolean;
  total: number;
  states: { new: number; learning: number; review: number; relearning: number };
  /** Cards that have been answered at least once. */
  introduced: number;
  /** Stability above 30 days (the app's mastery bar). */
  mastered: number;
  leeches: number;
  /** What the authored content supports; a missing sentence means no cloze. */
  content: {
    withSentence: number;
    withFoils: number;
    withVariants: number;
    withNotes: number;
    withClozeDistractors: number;
  };
}

export interface DeckCensus {
  totalCards: number;
  introducedCards: number;
  neverSeenCards: number;
  byDomain: DomainCensus[];
  /**
   * The domains of the next new cards the daily queue would introduce, run-length
   * encoded. A single long run means the learner will not meet the other
   * domains for weeks, however many they switched on.
   */
  newQueueAhead: { domain: DomainCategory; count: number }[];
}

export function buildDeckCensus(cards: VocabCard[], settings: UserSettings): DeckCensus {
  const byDomain = DOMAIN_CATEGORIES.map((domain): DomainCensus => {
    const inDomain = cards.filter((c) => c.domain === domain);
    const count = (predicate: (c: VocabCard) => boolean) => inDomain.filter(predicate).length;
    return {
      domain,
      active: settings.activeDomains.includes(domain),
      total: inDomain.length,
      states: {
        new: count((c) => c.fsrs.state === CardState.New),
        learning: count((c) => c.fsrs.state === CardState.Learning),
        review: count((c) => c.fsrs.state === CardState.Review),
        relearning: count((c) => c.fsrs.state === CardState.Relearning),
      },
      introduced: count((c) => c.fsrs.reps > 0),
      mastered: count((c) => c.fsrs.stability > MASTERY_STABILITY_DAYS),
      leeches: count((c) => c.fsrs.lapses >= settings.leechThreshold),
      content: {
        withSentence: count((c) => Boolean(c.exampleSentenceTraditional?.trim())),
        withFoils: count((c) => (c.visualFoils ?? []).length > 0),
        withVariants: count((c) => (c.variants ?? []).length > 0),
        withNotes: count((c) => Boolean(c.notes?.trim())),
        withClozeDistractors: count((c) => (c.clozeDistractors ?? []).length > 0),
      },
    };
  });

  // Mirror the real queue order so the preview shows what will actually happen.
  const upcoming = interleaveByDomain(
    cards
      .filter((c) => c.fsrs.state === CardState.New && isActiveDomain(c, settings))
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
          a.traditional.localeCompare(b.traditional, 'zh-Hant-TW'),
      ),
  ).slice(0, NEW_QUEUE_PREVIEW);
  const newQueueAhead: { domain: DomainCategory; count: number }[] = [];
  for (const card of upcoming) {
    const last = newQueueAhead[newQueueAhead.length - 1];
    if (last && last.domain === card.domain) last.count += 1;
    else newQueueAhead.push({ domain: card.domain, count: 1 });
  }

  return {
    totalCards: cards.length,
    introducedCards: cards.filter((c) => c.fsrs.reps > 0).length,
    neverSeenCards: cards.filter((c) => c.fsrs.reps === 0).length,
    byDomain,
    newQueueAhead,
  };
}

// ---- activity --------------------------------------------------------

export interface DayActivity {
  /** Local calendar day, the same key the app's streak and daily caps use. */
  day: string;
  answers: number;
  distinctCards: number;
  newCardsIntroduced: number;
  /** Sum of `timeSpentMs`; drills that grade several cards at once repeat it. */
  reportedTimeMs: number;
  ratings: RatingCounts;
  exercises: ExerciseCounts;
  retention: number | null;
}

export interface InferredSession {
  index: number;
  startedAt: string;
  endedAt: string;
  day: string;
  answers: number;
  distinctCards: number;
  spanMs: number;
  ratings: RatingCounts;
  exercises: ExerciseCounts;
  retention: number | null;
  /** Most answers any single card took in this session. */
  maxAnswersOnOneCard: number;
  /** The card that took them, when it took more than its share. */
  busiestCardId: string | null;
}

export interface Activity {
  firstAnswerAt: string | null;
  lastAnswerAt: string | null;
  studyDays: number;
  totalAnswers: number;
  reportedTimeMs: number;
  days: DayActivity[];
  sessions: InferredSession[];
  ratingsByExercise: Record<ExerciseType, RatingCounts>;
  ratingsByStateBefore: Record<StateName, RatingCounts>;
  latencyMsByExercise: Record<ExerciseType, Quantiles>;
  lapses: {
    total: number;
    /** Lapses caused by a multiple-choice drill rather than a self-rated recall. */
    fromDrills: number;
    byExercise: ExerciseCounts;
  };
}

function chronological(logs: ReviewLog[]): ReviewLog[] {
  return [...logs].sort((a, b) => a.reviewTimestamp.localeCompare(b.reviewTimestamp));
}

export function buildActivity(logs: ReviewLog[]): Activity {
  const ordered = chronological(logs);
  const days = new Map<string, DayActivity & { cardIds: Set<string> }>();
  const firstSeen = new Map<string, string>();
  const ratingsByExercise = Object.fromEntries(EXERCISES.map((e) => [e, emptyRatings()])) as Record<
    ExerciseType,
    RatingCounts
  >;
  const ratingsByStateBefore = Object.fromEntries(
    STATE_NAMES.map((s) => [s, emptyRatings()]),
  ) as Record<StateName, RatingCounts>;
  const latencies = Object.fromEntries(EXERCISES.map((e) => [e, [] as number[]])) as Record<
    ExerciseType,
    number[]
  >;
  const lapsesByExercise = emptyExercises();
  let lapseTotal = 0;
  let drillLapses = 0;
  let reportedTimeMs = 0;

  for (const log of ordered) {
    const key = dayKey(new Date(log.reviewTimestamp));
    let day = days.get(key);
    if (!day) {
      day = {
        day: key,
        answers: 0,
        distinctCards: 0,
        newCardsIntroduced: 0,
        reportedTimeMs: 0,
        ratings: emptyRatings(),
        exercises: emptyExercises(),
        retention: null,
        cardIds: new Set<string>(),
      };
      days.set(key, day);
    }
    day.answers += 1;
    day.reportedTimeMs += log.timeSpentMs;
    day.ratings[log.rating] += 1;
    day.exercises[log.exerciseType] += 1;
    day.cardIds.add(log.cardId);
    if (!firstSeen.has(log.cardId)) {
      firstSeen.set(log.cardId, log.reviewTimestamp);
      day.newCardsIntroduced += 1;
    }
    reportedTimeMs += log.timeSpentMs;
    ratingsByExercise[log.exerciseType][log.rating] += 1;
    ratingsByStateBefore[stateName(log.stateBefore)][log.rating] += 1;
    latencies[log.exerciseType].push(log.timeSpentMs);
    if (log.rating === 1) {
      lapseTotal += 1;
      lapsesByExercise[log.exerciseType] += 1;
      if (log.exerciseType !== 'rapid_recognition') drillLapses += 1;
    }
  }

  const dayList = Array.from(days.values())
    .map(({ cardIds, ...rest }) => ({
      ...rest,
      distinctCards: cardIds.size,
      retention: rest.answers === 0 ? null : round(1 - rest.ratings[1] / rest.answers),
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    firstAnswerAt: ordered[0]?.reviewTimestamp ?? null,
    lastAnswerAt: ordered[ordered.length - 1]?.reviewTimestamp ?? null,
    studyDays: dayList.length,
    totalAnswers: ordered.length,
    reportedTimeMs,
    days: dayList,
    sessions: inferSessions(ordered),
    ratingsByExercise,
    ratingsByStateBefore,
    latencyMsByExercise: Object.fromEntries(
      EXERCISES.map((e) => [e, quantiles(latencies[e])]),
    ) as Record<ExerciseType, Quantiles>,
    lapses: { total: lapseTotal, fromDrills: drillLapses, byExercise: lapsesByExercise },
  };
}

/**
 * Group answers into sessions by their gaps.
 *
 * Review logs carry no session id, so anything exported from history alone is
 * a reconstruction. Events recorded by the engine carry a real one; when the
 * export has both, prefer the events.
 */
export function inferSessions(logs: ReviewLog[]): InferredSession[] {
  const ordered = chronological(logs);
  const sessions: InferredSession[] = [];
  let bucket: ReviewLog[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const perCard = new Map<string, number>();
    const ratings = emptyRatings();
    const exercises = emptyExercises();
    for (const log of bucket) {
      perCard.set(log.cardId, (perCard.get(log.cardId) ?? 0) + 1);
      ratings[log.rating] += 1;
      exercises[log.exerciseType] += 1;
    }
    let busiestCardId: string | null = null;
    let maxAnswers = 0;
    for (const [cardId, count] of perCard) {
      if (count > maxAnswers) {
        maxAnswers = count;
        busiestCardId = cardId;
      }
    }
    const startedAt = bucket[0].reviewTimestamp;
    const endedAt = bucket[bucket.length - 1].reviewTimestamp;
    sessions.push({
      index: sessions.length,
      startedAt,
      endedAt,
      day: dayKey(new Date(startedAt)),
      answers: bucket.length,
      distinctCards: perCard.size,
      spanMs: new Date(endedAt).getTime() - new Date(startedAt).getTime(),
      ratings,
      exercises,
      retention: round(1 - ratings[1] / bucket.length),
      maxAnswersOnOneCard: maxAnswers,
      busiestCardId: maxAnswers > 1 ? busiestCardId : null,
    });
    bucket = [];
  };

  for (const log of ordered) {
    const previous = bucket[bucket.length - 1];
    if (
      previous &&
      new Date(log.reviewTimestamp).getTime() - new Date(previous.reviewTimestamp).getTime() >
        SESSION_GAP_MS
    ) {
      flush();
    }
    bucket.push(log);
  }
  flush();
  return sessions;
}

// ---- per-card rows ---------------------------------------------------

export interface CardAnswer {
  at: string;
  rating: RatingGrade;
  exercise: ExerciseType;
  stateBefore?: number;
  /** Scheduler state written by this answer. */
  stability: number;
  difficulty: number;
  scheduledDays: number;
  lapses: number;
  timeSpentMs: number;
  /** Hours since this card's previous answer, whenever there was one. */
  hoursSincePrevious: number | null;
}

export interface CardReport {
  id: string;
  traditional: string;
  domain: DomainCategory;
  /** What the card's content allows: no sentence means it can never be a cloze. */
  content: {
    hasSentence: boolean;
    foilCount: number;
    variantCount: number;
    hasNotes: boolean;
    clozeDistractorCount: number;
  };
  fsrs: {
    state: number;
    stability: number;
    difficulty: number;
    reps: number;
    lapses: number;
    scheduledDays: number;
    due: string;
  };
  answers: number;
  ratings: RatingCounts;
  exercises: ExerciseCounts;
  /** Answers the export could not include, once the history cap was hit. */
  historyTruncated: number;
  history: CardAnswer[];
  flags: string[];
}

/**
 * One row per card the learner has actually touched.
 *
 * The untouched remainder of the deck is only a count: a 1,967-card deck where
 * twenty cards have been studied is 1.8 MB of backup to carry sixty answers.
 */
export function buildCardReports(
  cards: VocabCard[],
  logs: ReviewLog[],
  settings: UserSettings,
): CardReport[] {
  const byCard = new Map<string, ReviewLog[]>();
  for (const log of chronological(logs)) {
    const list = byCard.get(log.cardId);
    if (list) list.push(log);
    else byCard.set(log.cardId, [log]);
  }

  const touched = cards.filter((c) => c.fsrs.reps > 0 || byCard.has(c.id));
  return touched
    .map((card): CardReport => {
      const history = byCard.get(card.id) ?? [];
      const ratings = emptyRatings();
      const exercises = emptyExercises();
      for (const log of history) {
        ratings[log.rating] += 1;
        exercises[log.exerciseType] += 1;
      }
      const kept = history.slice(-MAX_CARD_HISTORY);
      const flags: string[] = [];
      if (card.fsrs.lapses >= settings.leechThreshold) flags.push('leech');
      if (card.fsrs.difficulty >= DIFFICULTY_SATURATED) flags.push('difficulty_saturated');
      if (card.fsrs.state !== CardState.New && card.fsrs.stability <= STABILITY_FLOOR_DAYS) {
        flags.push('stability_floor');
      }
      if (card.fsrs.reps > 0 && history.length === 0) flags.push('history_missing');
      if (!card.exampleSentenceTraditional?.trim()) flags.push('no_sentence');
      if ((card.visualFoils ?? []).length === 0) flags.push('no_foils');

      return {
        id: card.id,
        traditional: card.traditional,
        domain: card.domain,
        content: {
          hasSentence: Boolean(card.exampleSentenceTraditional?.trim()),
          foilCount: (card.visualFoils ?? []).length,
          variantCount: (card.variants ?? []).length,
          hasNotes: Boolean(card.notes?.trim()),
          clozeDistractorCount: (card.clozeDistractors ?? []).length,
        },
        fsrs: {
          state: card.fsrs.state,
          stability: round(card.fsrs.stability, 6),
          difficulty: round(card.fsrs.difficulty, 6),
          reps: card.fsrs.reps,
          lapses: card.fsrs.lapses,
          scheduledDays: card.fsrs.scheduled_days,
          due: card.fsrs.due,
        },
        answers: history.length,
        ratings,
        exercises,
        historyTruncated: history.length - kept.length,
        history: kept.map((log, i) => {
          const previous = kept[i - 1];
          return {
            at: log.reviewTimestamp,
            rating: log.rating,
            exercise: log.exerciseType,
            stateBefore: log.stateBefore,
            stability: round(log.stability, 6),
            difficulty: round(log.difficulty, 6),
            scheduledDays: log.scheduled_days,
            lapses: log.lapses,
            timeSpentMs: log.timeSpentMs,
            hoursSincePrevious: previous
              ? round(
                  (new Date(log.reviewTimestamp).getTime() -
                    new Date(previous.reviewTimestamp).getTime()) /
                    3_600_000,
                  2,
                )
              : null,
          };
        }),
        flags,
      };
    })
    .sort((a, b) => b.answers - a.answers || a.traditional.localeCompare(b.traditional));
}

// ---- diagnostics -----------------------------------------------------

export type DiagnosticSeverity = 'info' | 'warn' | 'high';

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  title: string;
  /** What was measured, in one sentence, with the numbers in it. */
  detail: string;
  count: number;
  /** Card ids, days or session indices worth opening first. */
  examples: string[];
}

/**
 * Patterns worth looking at, computed here so the export says what it found
 * instead of leaving it to be rediscovered by hand every time.
 */
export function buildDiagnostics(
  cards: VocabCard[],
  logs: ReviewLog[],
  settings: UserSettings,
  deck: DeckCensus,
  activity: Activity,
): Diagnostic[] {
  const found: Diagnostic[] = [];
  const label = (id: string) => {
    const card = cards.find((c) => c.id === id);
    return card ? `${card.traditional} (${id.slice(0, 8)})` : id.slice(0, 8);
  };

  const loops = activity.sessions.filter((s) => s.maxAnswersOnOneCard >= LOOP_ANSWER_THRESHOLD);
  if (loops.length > 0) {
    const worst = loops.reduce((a, b) => (b.maxAnswersOnOneCard > a.maxAnswersOnOneCard ? b : a));
    found.push({
      code: 'in_session_repeat_loop',
      severity: 'high',
      title: 'One card took over a session',
      detail:
        `${loops.length} session(s) gave a single card ${LOOP_ANSWER_THRESHOLD}+ answers; ` +
        `the worst gave ${label(worst.busiestCardId ?? '')} ${worst.maxAnswersOnOneCard} of ` +
        `${worst.answers} answers. A card at the stability floor is always due inside the ` +
        `${Math.round(LEARN_AHEAD_MS / MINUTE_MS)}-minute learn-ahead window, so it returns at once.`,
      count: loops.length,
      examples: loops.map((s) => `${s.startedAt} · ${label(s.busiestCardId ?? '')}`).slice(0, 5),
    });
  }

  const saturated = cards.filter((c) => c.fsrs.difficulty >= DIFFICULTY_SATURATED);
  if (saturated.length > 0) {
    found.push({
      code: 'difficulty_saturated',
      severity: 'high',
      title: 'Cards pinned at maximum difficulty',
      detail:
        `${saturated.length} card(s) sit at difficulty ≥ ${DIFFICULTY_SATURATED}. FSRS has no ` +
        `harsher verdict left, so further failures cannot change the schedule and the card ` +
        `cannot climb out on its own.`,
      count: saturated.length,
      examples: saturated.slice(0, 5).map((c) => label(c.id)),
    });
  }

  const floored = cards.filter(
    (c) => c.fsrs.state !== CardState.New && c.fsrs.stability <= STABILITY_FLOOR_DAYS,
  );
  if (floored.length > 0) {
    found.push({
      code: 'stability_floor',
      severity: 'warn',
      title: 'Cards at the stability floor',
      detail:
        `${floored.length} card(s) have stability ≤ ${STABILITY_FLOOR_DAYS} days, i.e. every ` +
        `interval they are given is measured in minutes.`,
      count: floored.length,
      examples: floored.slice(0, 5).map((c) => label(c.id)),
    });
  }

  const leeches = cards.filter((c) => c.fsrs.lapses >= settings.leechThreshold);
  if (leeches.length > 0) {
    found.push({
      code: 'leech',
      severity: 'warn',
      title: 'Leeches in rotation',
      detail:
        `${leeches.length} card(s) are at or past the leech threshold of ` +
        `${settings.leechThreshold} lapses and are still scheduled like any other card.`,
      count: leeches.length,
      examples: leeches.slice(0, 5).map((c) => `${label(c.id)} · ${c.fsrs.lapses} lapses`),
    });
  }

  const guessFloorLapses = logs.filter(
    (l) =>
      l.rating === 1 &&
      l.exerciseType !== 'rapid_recognition' &&
      (l.stateBefore === CardState.Review || l.stateBefore === CardState.Relearning),
  );
  if (guessFloorLapses.length > 0) {
    found.push({
      code: 'guess_floor_lapse',
      severity: 'warn',
      title: 'Lapses charged by multiple-choice drills',
      detail:
        `${guessFloorLapses.length} of ${activity.lapses.total} lapse(s) came from a drill with ` +
        `a one-in-four guess floor, on a card already in Review or Relearning. A hit on such a ` +
        `card changes nothing, so drills can only cost these cards ground.`,
      count: guessFloorLapses.length,
      examples: guessFloorLapses.slice(0, 5).map((l) => `${l.exerciseType} · ${label(l.cardId)}`),
    });
  }

  const activeDomains = deck.byDomain.filter((d) => d.active && d.total > 0);
  const starved = activeDomains.filter((d) => d.introduced === 0);
  if (starved.length > 0 && activeDomains.some((d) => d.introduced > 0)) {
    found.push({
      code: 'domain_starvation',
      severity: activity.studyDays >= 2 ? 'warn' : 'info',
      title: 'Active domains never reached',
      detail:
        `${starved.length} of ${activeDomains.length} active domain(s) have not had a single ` +
        `card introduced across ${activity.studyDays} study day(s): ` +
        `${starved.map((d) => d.domain).join(', ')}.`,
      count: starved.length,
      examples: starved.map((d) => `${d.domain} · ${d.total} cards waiting`),
    });
  }

  const longestRun = deck.newQueueAhead.reduce((max, run) => Math.max(max, run.count), 0);
  if (activeDomains.length > 1 && longestRun >= settings.maxDailyNewCards * 3) {
    const run = deck.newQueueAhead.find((r) => r.count === longestRun)!;
    found.push({
      code: 'new_queue_single_domain_run',
      severity: 'warn',
      title: 'Upcoming new cards come from one domain',
      detail:
        `The next new cards include a run of ${longestRun} consecutive ${run.domain} cards — ` +
        `about ${Math.ceil(longestRun / Math.max(1, settings.maxDailyNewCards))} day(s) at the ` +
        `current limit of ${settings.maxDailyNewCards} new cards a day.`,
      count: longestRun,
      examples: deck.newQueueAhead.slice(0, 6).map((r) => `${r.domain} ×${r.count}`),
    });
  }

  const tooFast = logs.filter((l) => l.timeSpentMs < UNREADABLY_FAST_MS);
  if (tooFast.length > 0) {
    found.push({
      code: 'answered_faster_than_readable',
      severity: 'info',
      title: 'Answers too fast to be readings',
      detail:
        `${tooFast.length} answer(s) took under ${UNREADABLY_FAST_MS} ms. Either the card was ` +
        `already on screen from a re-queue, or the tap was reflex rather than recognition.`,
      count: tooFast.length,
      examples: tooFast.slice(0, 5).map((l) => `${label(l.cardId)} · ${l.timeSpentMs} ms`),
    });
  }

  const byStamp = new Map<string, number>();
  for (const log of logs) {
    const key = `${log.reviewTimestamp}|${log.timeSpentMs}`;
    byStamp.set(key, (byStamp.get(key) ?? 0) + 1);
  }
  const shared = Array.from(byStamp.values()).filter((n) => n > 1);
  if (shared.length > 0) {
    const overcount = shared.reduce((sum, n) => sum + n - 1, 0);
    found.push({
      code: 'shared_answer_timing',
      severity: 'info',
      title: 'One duration counted several times',
      detail:
        `${shared.length} answer group(s) share a timestamp and a duration — a drill that grades ` +
        `several cards at once writes the whole exercise's time onto each card. Time on task is ` +
        `overstated by up to ${overcount} duplicate reading(s).`,
      count: overcount,
      examples: Array.from(byStamp.entries())
        .filter(([, n]) => n > 1)
        .slice(0, 5)
        .map(([key, n]) => `${key.split('|')[0]} ×${n}`),
    });
  }

  const missingState = logs.filter((l) => l.stateBefore === undefined);
  if (missingState.length > 0) {
    found.push({
      code: 'missing_state_before',
      severity: 'info',
      title: 'Answers with no pre-answer state',
      detail:
        `${missingState.length} answer(s) carry no stateBefore, so they cannot be told apart ` +
        `from reviews and count against the daily review budget by default.`,
      count: missingState.length,
      examples: missingState.slice(0, 5).map((l) => `${l.reviewTimestamp} · ${label(l.cardId)}`),
    });
  }

  if (deck.totalCards > 0) {
    const reach = deck.introducedCards / deck.totalCards;
    if (reach < 0.05) {
      found.push({
        code: 'deck_barely_touched',
        severity: 'info',
        title: 'Almost none of the deck has been seen',
        detail:
          `${deck.introducedCards} of ${deck.totalCards} cards (${(reach * 100).toFixed(1)}%) ` +
          `have ever been answered. Deck-wide averages such as domain mastery are dominated by ` +
          `cards nobody has met.`,
        count: deck.neverSeenCards,
        examples: [],
      });
    }
  }

  return found;
}

// ---- the report ------------------------------------------------------

export interface AnalyticsReport {
  reportVersion: number;
  settings: UserSettings;
  deck: DeckCensus;
  activity: Activity;
  cards: CardReport[];
  diagnostics: Diagnostic[];
}

export function buildReport(
  cards: VocabCard[],
  logs: ReviewLog[],
  settings: UserSettings,
): AnalyticsReport {
  const deck = buildDeckCensus(cards, settings);
  const activity = buildActivity(logs);
  return {
    reportVersion: ANALYTICS_REPORT_VERSION,
    settings,
    deck,
    activity,
    cards: buildCardReports(cards, logs, settings),
    diagnostics: buildDiagnostics(cards, logs, settings, deck, activity),
  };
}

/** Sessions the engine actually recorded, when the export carries events. */
export function countRecordedSessions(events: StudyEvent[]): number {
  return new Set(events.map((e) => e.sessionId)).size;
}
