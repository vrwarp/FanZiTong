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
import {
  interleaveByDomain,
  isActiveDomain,
  isSettling,
  LEARN_AHEAD_MS,
  MAX_SESSION_REQUEUES,
  MIN_RETRY_GAP_MS,
  newCardCapacity,
  SETTLING_STABILITY_DAYS,
} from '@/lib/queue/session';
import { MASTERY_STABILITY_DAYS } from '@/lib/stats/analytics';
import {
  characterKnowledge,
  firstSightProfile,
  summarizeCharacters,
  type FirstSightDomain,
} from '@/lib/stats/characters';
import { DAY_MS, dayKey, MINUTE_MS } from '@/lib/util/time';
import { SENTENCE_COOLDOWN_MS } from '@/lib/exercises/cloze';
import { sortEvents, type SessionMode, type StudyEvent } from './events';

/**
 * Bumped whenever the report's shape changes incompatibly. Version 2: day
 * rows are keyed by the study day (turning over at 4 a.m. local, see
 * `environment.dayStartHour`) rather than the calendar day, and carry the
 * answers the scheduler was not consulted on.
 */
export const ANALYTICS_REPORT_VERSION = 2;

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
/** An answer that took longer than this was a phone in a pocket, not a reading. */
export const BACKGROUNDED_ANSWER_MS = 10 * MINUTE_MS;
/** How many not-yet-read characters the census lists by name. */
export const NOT_YET_CHARACTERS = 20;
/** One sentence clozed this often inside the cooldown window is a shape being recognised. */
export const CLOZE_REPEAT_THRESHOLD = 3;

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

/** The most of these instants that fall inside one window of the given length. */
function mostWithin(times: number[], windowMs: number): number {
  const sorted = [...times].sort((a, b) => a - b);
  let best = 0;
  let start = 0;
  for (let end = 0; end < sorted.length; end += 1) {
    while (sorted[end] - sorted[start] > windowMs) start += 1;
    best = Math.max(best, end - start + 1);
  }
  return best;
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
  /** Studied, but not yet stable for a day: the scheduler still brings them back daily. */
  settling: number;
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
  /** Settling words across the active domains — what the new-card hold counts. */
  settlingCards: number;
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
      settling: count(isSettling),
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
    settlingCards: cards.filter((c) => isActiveDomain(c, settings) && isSettling(c)).length,
    byDomain,
    newQueueAhead,
  };
}

// ---- activity --------------------------------------------------------

export interface DayActivity {
  /**
   * Local study day (YYYY-MM-DD), turning over at `environment.dayStartHour`
   * — the same key the app's streak, daily caps and once-a-day rule use, so a
   * sitting at 01:20 belongs to the evening before it.
   */
  day: string;
  /** Answers the scheduler heard (review logs). */
  answers: number;
  distinctCards: number;
  newCardsIntroduced: number;
  /** Sum of `timeSpentMs`; drills that grade several cards at once repeat it. */
  reportedTimeMs: number;
  ratings: RatingCounts;
  exercises: ExerciseCounts;
  retention: number | null;
  /** Answers on words that already had their verdict that day (events only; never logged). */
  retries: number;
  /**
   * Every answer the scheduler was not consulted on, from the event log:
   * retries, booked looks, hits on words in Review, misreads. The learner's
   * day is `answers + practice`; the per-exercise counts above are of
   * `answers` only.
   */
  practice: number;
  /** Drill misses on words in Review that booked a recognition look instead of a lapse. */
  booked: number;
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

/**
 * A session the engine recorded, with its retries: the answers the review log
 * never sees. Only study done since events shipped appears here.
 */
export interface RecordedSession {
  sessionId: string;
  mode: SessionMode;
  drillType?: ExerciseType;
  startedAt: string;
  endedAt: string;
  day: string;
  answers: number;
  retries: number;
  distinctCards: number;
  /** Null when the session has no end event (still open, or the app was closed). */
  completed: boolean | null;
  maxAnswersOnOneCard: number;
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
  /** Sessions with real boundaries, from the event log. */
  recordedSessions: RecordedSession[];
  /** Retries across the event log: recorded, never scheduled. */
  retries: { total: number; byExercise: ExerciseCounts };
  /** Drill misses on words in Review that booked a reading (events only). */
  booked: { total: number; byExercise: ExerciseCounts };
  /**
   * The heritage reader's fingerprint: how each domain was rated the first
   * time its words were seen. Good/Easy on sight was already in the lexicon.
   */
  firstSight: FirstSightDomain[];
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

export function buildActivity(
  logs: ReviewLog[],
  events: StudyEvent[] = [],
  cards: VocabCard[] = [],
): Activity {
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
        retries: 0,
        practice: 0,
        booked: 0,
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

  // Practice lives only in the event log; a day with nothing else gets no row,
  // because a retry needs a verdict (logged) earlier the same day.
  const retriesByExercise = emptyExercises();
  const bookedByExercise = emptyExercises();
  let retryTotal = 0;
  let bookedTotal = 0;
  for (const event of events) {
    if (event.kind !== 'answer' || !event.exerciseType) continue;
    const day = days.get(dayKey(new Date(event.at)));
    if (event.applied === false && day) day.practice += 1;
    if (event.retry) {
      retryTotal += 1;
      retriesByExercise[event.exerciseType] += 1;
      if (day) day.retries += 1;
    }
    if (event.booked) {
      bookedTotal += 1;
      bookedByExercise[event.exerciseType] += 1;
      if (day) day.booked += 1;
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
    recordedSessions: summarizeRecordedSessions(events),
    retries: { total: retryTotal, byExercise: retriesByExercise },
    booked: { total: bookedTotal, byExercise: bookedByExercise },
    firstSight: firstSightProfile(cards, logs),
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

/** One row per session the engine recorded, retries included. */
export function summarizeRecordedSessions(events: StudyEvent[]): RecordedSession[] {
  const bySession = new Map<string, StudyEvent[]>();
  for (const event of sortEvents(events)) {
    const list = bySession.get(event.sessionId);
    if (list) list.push(event);
    else bySession.set(event.sessionId, [event]);
  }
  const sessions: RecordedSession[] = [];
  for (const [sessionId, list] of bySession) {
    const answers = list.filter((e) => e.kind === 'answer');
    const perCard = new Map<string, number>();
    for (const answer of answers) {
      if (!answer.cardId) continue;
      perCard.set(answer.cardId, (perCard.get(answer.cardId) ?? 0) + 1);
    }
    let busiestCardId: string | null = null;
    let maxAnswers = 0;
    for (const [cardId, count] of perCard) {
      if (count > maxAnswers) {
        maxAnswers = count;
        busiestCardId = cardId;
      }
    }
    const end = list.find((e) => e.kind === 'session_end');
    const first = list[0];
    sessions.push({
      sessionId,
      mode: first.mode,
      ...(first.drillType ? { drillType: first.drillType } : {}),
      startedAt: first.at,
      endedAt: list[list.length - 1].at,
      day: dayKey(new Date(first.at)),
      answers: answers.length,
      retries: answers.filter((e) => e.retry).length,
      distinctCards: perCard.size,
      completed: end ? (end.completed ?? null) : null,
      maxAnswersOnOneCard: maxAnswers,
      busiestCardId: maxAnswers > 1 ? busiestCardId : null,
    });
  }
  return sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
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
  /** Answers on this word that the scheduler was not consulted on (events only). */
  retries: number;
  /** Drill misses on this word while in Review that booked a reading (events only). */
  booked: number;
  /** How many of the card's lapses were charged by a drill rather than a reading. */
  lapsesFromDrills: number;
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
  events: StudyEvent[] = [],
): CardReport[] {
  const byCard = new Map<string, ReviewLog[]>();
  for (const log of chronological(logs)) {
    const list = byCard.get(log.cardId);
    if (list) list.push(log);
    else byCard.set(log.cardId, [log]);
  }
  const retriesByCard = new Map<string, number>();
  const bookedByCard = new Map<string, number>();
  for (const event of events) {
    if (event.kind !== 'answer' || !event.cardId) continue;
    if (event.retry) retriesByCard.set(event.cardId, (retriesByCard.get(event.cardId) ?? 0) + 1);
    if (event.booked) bookedByCard.set(event.cardId, (bookedByCard.get(event.cardId) ?? 0) + 1);
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
        retries: retriesByCard.get(card.id) ?? 0,
        booked: bookedByCard.get(card.id) ?? 0,
        lapsesFromDrills: history.filter(
          (l) =>
            l.rating === 1 &&
            l.exerciseType !== 'rapid_recognition' &&
            (l.stateBefore === CardState.Review || l.stateBefore === CardState.Relearning),
        ).length,
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
  cardReports: CardReport[] = [],
  events: StudyEvent[] = [],
): Diagnostic[] {
  const found: Diagnostic[] = [];
  const label = (id: string) => {
    const card = cards.find((c) => c.id === id);
    return card ? `${card.traditional} (${id.slice(0, 8)})` : id.slice(0, 8);
  };

  // Recorded sessions see retries, which never reach the log; the
  // reconstruction covers whatever happened before events shipped.
  const recordedFrom = activity.recordedSessions[0]?.startedAt;
  const loops = [
    ...activity.sessions.filter((s) => !recordedFrom || s.endedAt < recordedFrom),
    ...activity.recordedSessions,
  ].filter((s) => s.maxAnswersOnOneCard >= LOOP_ANSWER_THRESHOLD);
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
        `${Math.round(LEARN_AHEAD_MS / MINUTE_MS)}-minute learn-ahead window, so it returns at ` +
        `once; the engine now caps a card at ${MAX_SESSION_REQUEUES} returns a session and ` +
        `${Math.round(MIN_RETRY_GAP_MS / 1000)} s between looks, so a loop this size predates that.`,
      count: loops.length,
      examples: loops.map((s) => `${s.startedAt} · ${label(s.busiestCardId ?? '')}`).slice(0, 5),
    });
  }

  if (activity.retries.total > 0) {
    const retriesByCard = new Map<string, number>();
    for (const card of cardReports) if (card.retries > 0) retriesByCard.set(card.id, card.retries);
    const top = Array.from(retriesByCard.entries()).sort((a, b) => b[1] - a[1]);
    found.push({
      code: 'same_day_retries',
      severity: 'info',
      title: 'Answers that never reached the scheduler',
      detail:
        `${activity.retries.total} answer(s) were retries on a word that already had its verdict ` +
        `that day — knocked down, or read correctly in recognition: recorded, and the word came ` +
        `back, but FSRS was not consulted again. A word is knocked down at most once a day, so a ` +
        `second same-day miss cannot push its difficulty toward 10. These answers appear in ` +
        `events only.`,
      count: activity.retries.total,
      examples: top.slice(0, 5).map(([id, n]) => `${label(id)} · ${n} retries`),
    });
  }

  const hasNewCards = deck.byDomain.some((d) => d.active && d.states.new > 0);
  if (settings.maxSettlingCards > 0 && hasNewCards) {
    const capacity = newCardCapacity(settings, deck.settlingCards);
    if (capacity < settings.maxDailyNewCards) {
      found.push({
        code: 'settling_hold',
        severity: capacity === 0 ? 'warn' : 'info',
        title: capacity === 0 ? 'New cards on hold' : 'New cards limited by settling words',
        detail:
          `${deck.settlingCards} studied word(s) are still settling (stability under ` +
          `${SETTLING_STABILITY_DAYS} day) against a hold of ${settings.maxSettlingCards}, leaving ` +
          `room for ${capacity} new card(s) a day instead of the daily limit of ` +
          `${settings.maxDailyNewCards}. New words return as these stick; the learner can ` +
          `raise or switch off the hold in Settings.`,
        count: deck.settlingCards,
        examples: cards
          .filter((c) => isActiveDomain(c, settings) && isSettling(c))
          .sort((a, b) => a.fsrs.stability - b.fsrs.stability)
          .slice(0, 5)
          .map((c) => `${label(c.id)} · S=${round(c.fsrs.stability, 3)} d`),
      });
    }
  } else if (settings.maxSettlingCards <= 0 && deck.settlingCards > settings.maxDailyNewCards * 2) {
    found.push({
      code: 'settling_hold',
      severity: 'warn',
      title: 'Many settling words and no hold',
      detail:
        `${deck.settlingCards} studied word(s) are still settling and the hold is switched off, ` +
        `so new cards keep arriving at ${settings.maxDailyNewCards} a day on top of them.`,
      count: deck.settlingCards,
      examples: [],
    });
  }

  const saturated = cards.filter((c) => c.fsrs.difficulty >= DIFFICULTY_SATURATED);
  if (saturated.length > 0) {
    const source = (c: VocabCard) => {
      const report = cardReports.find((r) => r.id === c.id);
      if (!report || c.fsrs.lapses === 0) return '';
      return ` · ${report.lapsesFromDrills} of ${c.fsrs.lapses} lapse(s) from drills`;
    };
    found.push({
      code: 'difficulty_saturated',
      severity: 'high',
      title: 'Cards pinned at maximum difficulty',
      detail:
        `${saturated.length} card(s) sit at difficulty ≥ ${DIFFICULTY_SATURATED}. FSRS has no ` +
        `harsher verdict left, so further failures cannot change the schedule and the card ` +
        `cannot climb out on its own. Each example says where its lapses came from: a lapse ` +
        `charged by a drill is one the reading may never have confirmed.`,
      count: saturated.length,
      examples: saturated.slice(0, 5).map((c) => `${label(c.id)}${source(c)}`),
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

  // A drill lapse on a word in Review, or on a word the learner had read
  // correctly earlier that day: a discrimination slip charged as forgetting.
  const passesByCardDay = new Set<string>();
  for (const log of logs) {
    if (log.exerciseType === 'rapid_recognition' && log.rating >= 3) {
      passesByCardDay.add(`${log.cardId}|${dayKey(new Date(log.reviewTimestamp))}`);
    }
  }
  const drillLapses = chronological(logs).filter((l, index, all) => {
    if (l.rating !== 1 || l.exerciseType === 'rapid_recognition') return false;
    if (l.stateBefore === CardState.Review) return true;
    const day = dayKey(new Date(l.reviewTimestamp));
    return all
      .slice(0, index)
      .some(
        (p) =>
          p.cardId === l.cardId &&
          p.exerciseType === 'rapid_recognition' &&
          p.rating >= 3 &&
          dayKey(new Date(p.reviewTimestamp)) === day,
      );
  });
  if (drillLapses.length > 0) {
    const afterReading = drillLapses.filter((l) =>
      passesByCardDay.has(`${l.cardId}|${dayKey(new Date(l.reviewTimestamp))}`),
    ).length;
    found.push({
      code: 'drill_lapse_after_reading',
      severity: 'warn',
      title: 'Lapses charged by a drill the reading contradicts',
      detail:
        `${drillLapses.length} of ${activity.lapses.total} lapse(s) were charged by a ` +
        `four-tile drill on a word in Review, ${afterReading} of them on a day the learner had ` +
        `already read the word correctly in recognition. A forced-choice miss is a ` +
        `discrimination slip, not a forgetting. A word in Review is now moved only by reading ` +
        `— a drill miss books a recognition look instead — and any drill answer on a word ` +
        `already read that day is practice; the first launch of that build replays the ` +
        `history under the rule, so these predate it.`,
      count: drillLapses.length,
      examples: drillLapses.slice(0, 5).map((l) => `${l.exerciseType} · ${label(l.cardId)}`),
    });
  }

  // The scheduler measured elapsed time in whole UTC calendar days before it
  // was told the time in study days; for a learner west of UTC that put the
  // day boundary in the late afternoon.
  const byCardChrono = new Map<string, ReviewLog[]>();
  for (const log of chronological(logs)) {
    const list = byCardChrono.get(log.cardId);
    if (list) list.push(log);
    else byCardChrono.set(log.cardId, [log]);
  }
  const utcDay = (iso: string) => iso.slice(0, 10);
  const daysBetween = (a: string, b: string) =>
    Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  const mismatched: { log: ReviewLog; previous: ReviewLog; scheduler: number; study: number }[] =
    [];
  let pairs = 0;
  for (const history of byCardChrono.values()) {
    for (let i = 1; i < history.length; i += 1) {
      const previous = history[i - 1];
      const log = history[i];
      pairs += 1;
      const scheduler = daysBetween(utcDay(previous.reviewTimestamp), utcDay(log.reviewTimestamp));
      const study = daysBetween(
        dayKey(new Date(previous.reviewTimestamp)),
        dayKey(new Date(log.reviewTimestamp)),
      );
      if (scheduler !== study) mismatched.push({ log, previous, scheduler, study });
    }
  }
  if (mismatched.length > 0) {
    const overnightAsSameDay = mismatched.filter((m) => m.scheduler === 0 && m.study >= 1).length;
    const hours = (m: (typeof mismatched)[number]) =>
      round(
        (new Date(m.log.reviewTimestamp).getTime() -
          new Date(m.previous.reviewTimestamp).getTime()) /
          3_600_000,
        1,
      );
    found.push({
      code: 'scheduler_day_mismatch',
      severity: 'warn',
      title: 'Reviews the scheduler dated on the wrong day',
      detail:
        `${mismatched.length} of ${pairs} consecutive answer pair(s) fell on different sides of ` +
        `a day for the scheduler (whole UTC calendar days) than for the learner (study days ` +
        `from 4 a.m. local); ${overnightAsSameDay} of them were a night's sleep scored as ` +
        `same-day, which uses FSRS's short-term formula instead of the recall formula that ` +
        `lets an overnight pass grow stability. The scheduler is now told the time in study ` +
        `days, and the first launch of that build replays the history on that clock, so these ` +
        `predate it.`,
      count: mismatched.length,
      examples: mismatched
        .slice(0, 5)
        .map(
          (m) =>
            `${label(m.log.cardId)} · ${hours(m)} h apart · scheduler ${m.scheduler} d, study ${m.study} d`,
        ),
    });
  }

  const backgrounded = events.filter(
    (e) => e.kind === 'answer' && (e.latencyMs ?? 0) > BACKGROUNDED_ANSWER_MS,
  );
  if (backgrounded.length > 0) {
    const excessMs = backgrounded.reduce(
      (sum, e) => sum + Math.max(0, (e.latencyMs ?? 0) - BACKGROUNDED_ANSWER_MS),
      0,
    );
    found.push({
      code: 'backgrounded_answers',
      severity: 'info',
      title: 'Answers that took longer than a reading can',
      detail:
        `${backgrounded.length} answer(s) took over ${Math.round(BACKGROUNDED_ANSWER_MS / MINUTE_MS)} ` +
        `minutes — a phone put away with a card on screen, about ${Math.round(excessMs / MINUTE_MS)} ` +
        `minute(s) in all. Time on task written before this build is overstated by that much; ` +
        `the engine now counts at most two minutes per answer and keeps the raw latency here.`,
      count: backgrounded.length,
      examples: backgrounded
        .slice(0, 5)
        .map(
          (e) =>
            `${e.at} · ${label(e.cardId ?? '')} · ${Math.round((e.latencyMs ?? 0) / MINUTE_MS)} min`,
        ),
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

  // A Fill the Blank on the same sentence again and again tests the memory
  // of its shape, not the reading. Events name the sentence since this
  // build; before it a card had one sentence, so the card stands in for it.
  const clozes = new Map<string, { cardId: string; sentence: string | null; at: number[] }>();
  for (const e of sortEvents(events)) {
    if (e.kind !== 'answer' || e.exerciseType !== 'cloze' || !e.cardId) continue;
    const key = e.sentence ?? `card:${e.cardId}`;
    const entry = clozes.get(key) ?? { cardId: e.cardId, sentence: e.sentence ?? null, at: [] };
    entry.at.push(Date.parse(e.at));
    clozes.set(key, entry);
  }
  const repeated = Array.from(clozes.values())
    .map((entry) => ({ ...entry, inWindow: mostWithin(entry.at, SENTENCE_COOLDOWN_MS) }))
    .filter((entry) => entry.inWindow >= CLOZE_REPEAT_THRESHOLD)
    .sort((a, b) => b.inWindow - a.inWindow);
  if (repeated.length > 0) {
    const worst = repeated[0];
    const windowDays = Math.round(SENTENCE_COOLDOWN_MS / DAY_MS);
    found.push({
      code: 'cloze_sentence_repeats',
      severity: 'warn',
      title: 'The same sentence clozed again and again',
      detail:
        `${repeated.length} sentence(s) were clozed ${CLOZE_REPEAT_THRESHOLD}+ times inside ` +
        `${windowDays} days; the worst, on ${label(worst.cardId)}, ${worst.inWindow} times. A frame ` +
        `filled in that often is recognised by its shape, not read. Fill the Blank now holds a ` +
        `sentence back for ${windowDays} days after it is clozed and rotates through the word's ` +
        `other sentences, so repeats this dense predate that build.`,
      count: repeated.length,
      examples: repeated
        .slice(0, 5)
        .map((r) => `${label(r.cardId)} ×${r.inWindow}${r.sentence ? ` · ${r.sentence}` : ''}`),
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

/**
 * The characters behind the words: which have been read in a real test and
 * which have only ever been failed. Almost every hard word fails on one
 * character the learner has never read anywhere else.
 */
export interface CharacterCensus {
  /** Distinct characters across the studied words. */
  met: number;
  /** Read correctly on first sight or on a later day, in at least one word. */
  read: number;
  /** Met, never read in a real test. */
  notYet: number;
  /** The not-yet characters, most-failed first, with the words they appear in. */
  notYetExamples: { char: string; words: string[]; failedIn: string[] }[];
}

export function buildCharacterCensus(cards: VocabCard[], logs: ReviewLog[]): CharacterCensus {
  const summary = summarizeCharacters(characterKnowledge(cards, logs));
  return {
    met: summary.met,
    read: summary.read,
    notYet: summary.notYet,
    notYetExamples: summary.notYetChars
      .slice(0, NOT_YET_CHARACTERS)
      .map((f) => ({ char: f.char, words: f.words, failedIn: f.failedIn })),
  };
}

export interface AnalyticsReport {
  reportVersion: number;
  settings: UserSettings;
  deck: DeckCensus;
  activity: Activity;
  characters: CharacterCensus;
  cards: CardReport[];
  diagnostics: Diagnostic[];
}

export function buildReport(
  cards: VocabCard[],
  logs: ReviewLog[],
  settings: UserSettings,
  events: StudyEvent[] = [],
): AnalyticsReport {
  const deck = buildDeckCensus(cards, settings);
  const activity = buildActivity(logs, events, cards);
  const cardReports = buildCardReports(cards, logs, settings, events);
  return {
    reportVersion: ANALYTICS_REPORT_VERSION,
    settings,
    deck,
    activity,
    characters: buildCharacterCensus(cards, logs),
    cards: cardReports,
    diagnostics: buildDiagnostics(cards, logs, settings, deck, activity, cardReports, events),
  };
}

/** Sessions the engine actually recorded, when the export carries events. */
export function countRecordedSessions(events: StudyEvent[]): number {
  return new Set(events.map((e) => e.sessionId)).size;
}
