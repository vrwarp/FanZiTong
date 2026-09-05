import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type FSRS,
  type Grade,
  type RecordLogItem,
} from 'ts-fsrs';
import type { FsrsState, RatingGrade, UserSettings } from '@/types';
import { formatInterval } from '@/lib/util/time';

export const MAXIMUM_INTERVAL_DAYS = 365;

/**
 * Build a ts-fsrs scheduler for the user's target retention. The default
 * FSRS-5 weights are used; the short-term (learning steps) scheduler is on so
 * "Again" comes back within minutes, exactly as the PRD describes.
 */
export function createScheduler(
  settings: Pick<UserSettings, 'targetRetention'>,
  options: { enableFuzz?: boolean } = {},
): FSRS {
  const params = generatorParameters({
    request_retention: clampRetention(settings.targetRetention),
    maximum_interval: MAXIMUM_INTERVAL_DAYS,
    enable_fuzz: options.enableFuzz ?? true,
    enable_short_term: true,
  });
  return fsrs(params);
}

export function clampRetention(value: number): number {
  if (!Number.isFinite(value)) return 0.9;
  return Math.min(0.99, Math.max(0.7, value));
}

/** A brand-new FSRS state (state 0 / New, due now). */
export function newFsrsState(now: Date = new Date()): FsrsState {
  return fromFsrsCard(createEmptyCard(now));
}

export function toFsrsCard(state: FsrsState): Card {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    learning_steps: state.learning_steps ?? 0,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  };
}

export function fromFsrsCard(card: Card): FsrsState {
  const state: FsrsState = {
    due: new Date(card.due).toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    learning_steps: card.learning_steps,
  };
  if (card.last_review) state.last_review = new Date(card.last_review).toISOString();
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
): Record<RatingGrade, RatingPreview> {
  const preview = scheduler.repeat(toFsrsCard(state), now);
  const out = {} as Record<RatingGrade, RatingPreview>;
  for (const rating of [1, 2, 3, 4] as const) {
    const item = preview[rating as Grade];
    out[rating] = {
      rating,
      due: item.card.due,
      intervalLabel: formatInterval(now, item.card.due),
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
): AppliedRating {
  const item = scheduler.next(toFsrsCard(state), now, rating as Grade);
  return { next: fromFsrsCard(item.card), item };
}

/** Current probability of recall (0-1), or null for cards never reviewed. */
export function retrievability(scheduler: FSRS, state: FsrsState, now: Date): number | null {
  if (state.state === 0 || state.reps === 0) return null;
  const r = scheduler.get_retrievability(toFsrsCard(state), now, false);
  return Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : null;
}

export function isDue(state: FsrsState, now: Date): boolean {
  return state.state !== 0 && new Date(state.due).getTime() <= now.getTime();
}
