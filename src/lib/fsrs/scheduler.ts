import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type FSRS,
  type Grade,
  type RecordLogItem,
  type StepUnit,
} from 'ts-fsrs';
import type { FsrsState, RatingGrade, UserSettings } from '@/types';
import { DAY_START_HOUR, formatInterval, HOUR_MS, MINUTE_MS } from '@/lib/util/time';

export const MAXIMUM_INTERVAL_DAYS = 365;

/**
 * Learning steps for a new word: a minute, ten minutes, then three hours.
 *
 * The first two are FSRS's defaults and fit inside one sitting. The third is
 * for the heritage reader, who meets a never-seen word by failing it and then
 * gets three looks in five minutes and nothing until tomorrow, where the model
 * itself predicts under 80% recall. Three hours lands the word in the next
 * sitting — this learner does two to four a day — as a real retrieval attempt;
 * when there is no next sitting it is simply tomorrow's first test, as before.
 * A lapsed word gets the same second look after its ten minutes.
 */
export const LEARNING_STEPS: readonly StepUnit[] = ['1m', '10m', '3h'];
export const RELEARNING_STEPS: readonly StepUnit[] = ['10m', '3h'];
/** The steps the app scheduled with before the three-hour step: ts-fsrs's defaults. */
export const LEGACY_LEARNING_STEPS: readonly StepUnit[] = ['1m', '10m'];
export const LEGACY_RELEARNING_STEPS: readonly StepUnit[] = ['10m'];

export interface SchedulerOptions {
  enableFuzz?: boolean;
  /** Override the learning steps (a history replay under an older rule needs the steps of its day). */
  learningSteps?: readonly StepUnit[];
  relearningSteps?: readonly StepUnit[];
}

/**
 * Build a ts-fsrs scheduler for the user's target retention. The default
 * FSRS-6 weights are used; the short-term (learning steps) scheduler is on so
 * "Again" comes back within minutes, exactly as the PRD describes.
 */
export function createScheduler(
  settings: Pick<UserSettings, 'targetRetention'>,
  options: SchedulerOptions = {},
): FSRS {
  const params = generatorParameters({
    request_retention: clampRetention(settings.targetRetention),
    maximum_interval: MAXIMUM_INTERVAL_DAYS,
    enable_fuzz: options.enableFuzz ?? true,
    enable_short_term: true,
    learning_steps: [...(options.learningSteps ?? LEARNING_STEPS)],
    relearning_steps: [...(options.relearningSteps ?? RELEARNING_STEPS)],
  });
  return fsrs(params);
}

export function clampRetention(value: number): number {
  if (!Number.isFinite(value)) return 0.9;
  return Math.min(0.99, Math.max(0.7, value));
}

/**
 * What time the scheduler is told.
 *
 * ts-fsrs measures the gap between two reviews in whole UTC calendar days,
 * and FSRS-6 scores two reviews inside one such day with its short-term
 * formula (a small stability change) rather than the recall formula that
 * lets an overnight pass multiply stability. For a learner seven hours west
 * of UTC the scheduler's day therefore turns over at 5 p.m.: a word studied
 * at 00:30 and read again at 07:40, after a night's sleep, counted as
 * "same day", while a five-hour gap across 5 p.m. counted as a day. The
 * study-day clock shifts every instant handed to the scheduler so that its
 * UTC date is the learner's study day (local time, turning over at
 * `DAY_START_HOUR`), and shifts what comes back the other way. FSRS still
 * computes every interval and every memory state; it is only told what day it
 * is in the same terms the learner lives in, which is how Anki's FSRS reads
 * the collection's day cutoff.
 */
export interface SchedulerClock {
  /** The instant as the scheduler should see it. */
  toScheduler(date: Date): Date;
  /** A scheduler instant back in real time. */
  fromScheduler(date: Date): Date;
}

/** The clock the app used before the study day existed: real time, UTC days. */
export const UTC_CLOCK: SchedulerClock = {
  toScheduler: (date) => new Date(date.getTime()),
  fromScheduler: (date) => new Date(date.getTime()),
};

/** Shift so that the UTC date of the result is the local study day's date. */
function studyDayShiftMs(date: Date, dayStartHour: number): number {
  return -date.getTimezoneOffset() * MINUTE_MS - dayStartHour * HOUR_MS;
}

export function studyDayClock(dayStartHour: number = DAY_START_HOUR): SchedulerClock {
  return {
    toScheduler: (date) => new Date(date.getTime() + studyDayShiftMs(date, dayStartHour)),
    fromScheduler: (date) => new Date(date.getTime() - studyDayShiftMs(date, dayStartHour)),
  };
}

/** The clock every schedule is computed with. */
export const STUDY_DAY_CLOCK: SchedulerClock = studyDayClock();

/** A brand-new FSRS state (state 0 / New, due now). */
export function newFsrsState(now: Date = new Date()): FsrsState {
  return fromFsrsCard(createEmptyCard(now));
}

/**
 * The card as the scheduler wants it, with its dates on the given clock. The
 * raw conversion (no clock) is the identity in time, for round trips and for
 * histories that were scheduled before the study-day clock existed.
 */
export function toFsrsCard(state: FsrsState, clock: SchedulerClock = UTC_CLOCK): Card {
  return {
    due: clock.toScheduler(new Date(state.due)),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    learning_steps: state.learning_steps ?? 0,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.last_review ? clock.toScheduler(new Date(state.last_review)) : undefined,
  };
}

/** A scheduler card back into stored state, its dates back in real time. */
export function fromFsrsCard(card: Card, clock: SchedulerClock = UTC_CLOCK): FsrsState {
  const state: FsrsState = {
    due: clock.fromScheduler(new Date(card.due)).toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    learning_steps: card.learning_steps,
  };
  if (card.last_review) {
    state.last_review = clock.fromScheduler(new Date(card.last_review)).toISOString();
  }
  return state;
}

export interface RatingPreview {
  rating: RatingGrade;
  due: Date;
  /** e.g. "<10m", "3d" — shown on the rating button. */
  intervalLabel: string;
  scheduledDays: number;
  state: number;
}

/** Preview what each of the four ratings would do, for the rating buttons. */
export function previewRatings(
  scheduler: FSRS,
  state: FsrsState,
  now: Date,
  clock: SchedulerClock = STUDY_DAY_CLOCK,
): Record<RatingGrade, RatingPreview> {
  const preview = scheduler.repeat(toFsrsCard(state, clock), clock.toScheduler(now));
  const out = {} as Record<RatingGrade, RatingPreview>;
  for (const rating of [1, 2, 3, 4] as const) {
    const item = preview[rating as Grade];
    const due = clock.fromScheduler(item.card.due);
    out[rating] = {
      rating,
      due,
      intervalLabel: formatInterval(now, due),
      scheduledDays: item.card.scheduled_days,
      state: item.card.state,
    };
  }
  return out;
}

export interface AppliedRating {
  next: FsrsState;
  item: RecordLogItem;
}

/** Apply a rating and return the next FSRS state (pure; nothing is persisted). */
export function applyRating(
  scheduler: FSRS,
  state: FsrsState,
  rating: RatingGrade,
  now: Date,
  clock: SchedulerClock = STUDY_DAY_CLOCK,
): AppliedRating {
  const item = scheduler.next(toFsrsCard(state, clock), clock.toScheduler(now), rating as Grade);
  return { next: fromFsrsCard(item.card, clock), item };
}

/** Current probability of recall (0-1), or null for cards never reviewed. */
export function retrievability(
  scheduler: FSRS,
  state: FsrsState,
  now: Date,
  clock: SchedulerClock = STUDY_DAY_CLOCK,
): number | null {
  if (state.state === 0 || state.reps === 0) return null;
  const r = scheduler.get_retrievability(toFsrsCard(state, clock), clock.toScheduler(now), false);
  return Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : null;
}

export function isDue(state: FsrsState, now: Date): boolean {
  return state.state !== 0 && new Date(state.due).getTime() <= now.getTime();
}
