import type { FoilSource, FoilStrategy } from '@/lib/exercises/foil';
import type { ExerciseType, RatingGrade } from '@/types';

/** Bumped whenever the shape of a `StudyEvent` changes incompatibly. */
export const STUDY_EVENT_VERSION = 1;

/**
 * How many events are kept on the device. Roughly a year of heavy study at
 * a few hundred answers a day; the oldest are dropped first.
 */
export const STUDY_EVENT_LIMIT = 50_000;

export type StudyEventKind = 'session_start' | 'answer' | 'drill_skip' | 'session_end';

/** A daily study session, or a standalone drill launched from Drills/Stats. */
export type SessionMode = 'daily' | 'drill';

/**
 * One thing that happened during study.
 *
 * This is deliberately NOT the review log. A `ReviewLog` records what the
 * scheduler did, so it exists only when a rating changed the schedule: a
 * correct drill answer on a card already in Review writes nothing at all,
 * which makes retention computed from review logs read worse than the truth.
 * A `StudyEvent` records what the learner did, whether or not FSRS cared.
 *
 * Every field beyond the header is optional: an event carries what its kind
 * knows and nothing else, so the log stays small enough to ship in an export.
 */
export interface StudyEvent {
  id: string;
  sessionId: string;
  /** Order within the session. Events sort by this, never by the clock. */
  seq: number;
  at: string;
  kind: StudyEventKind;
  mode: SessionMode;
  /** Which drill a standalone session is running. */
  drillType?: ExerciseType;

  // ---- session_start / session_end ----------------------------------
  /** Recognition cards queued when the session opened. */
  planned?: number;
  /** Pre-built drills queued when the session opened. */
  plannedDrills?: number;
  /** True when this session picked up one paused earlier today. */
  resumed?: boolean;
  /** session_end: true when the queue ran out, false when the learner left. */
  completed?: boolean;
  /** session_end: answers given, and time on task excluding pauses. */
  answered?: number;
  elapsedMs?: number;

  // ---- answer / drill_skip ------------------------------------------
  cardId?: string;
  exerciseType?: ExerciseType;
  rating?: RatingGrade;
  /** False when the answer was recorded but left the schedule alone. */
  applied?: boolean;
  /**
   * True for an answer on a word already knocked down today: practice that
   * was recorded and brought the word back, but never reached the scheduler.
   */
  retry?: boolean;
  correct?: boolean;
  /** Time from the step appearing to the answer. */
  latencyMs?: number;
  /** Recognition only: time from the prompt appearing to the reveal tap. */
  revealLatencyMs?: number;
  /** How many times this card had already been answered in this session. */
  repeatIndex?: number;
  /** The wrong option the learner picked, when the exercise knows it. */
  picked?: string;
  /** Misses before the shape was found, for drills that allow a retry. */
  misses?: number;
  /**
   * Spot the Character only: which confusion the wrong options were made of,
   * and how the set was balanced. Accuracy on this drill is not comparable
   * across these — a set of same-sound candidates asks a harder question than
   * a set of look-alikes, and both ask a harder one than the sets built before
   * the generator stopped leaving the answer at the centre. Recorded so the
   * diagnostics can split the history rather than show a cliff.
   */
  foilSource?: FoilSource;
  foilStrategy?: FoilStrategy;

  // ---- scheduler state, before and after ----------------------------
  stateBefore?: number;
  stateAfter?: number;
  stabilityBefore?: number;
  stabilityAfter?: number;
  difficultyBefore?: number;
  difficultyAfter?: number;
  scheduledDaysAfter?: number;
  /** Days since the card's previous review, as FSRS saw it. */
  elapsedDaysBefore?: number;
}

/** Where the engine sends its events; the caller decides whether to store them. */
export type StudyEventSink = (event: StudyEvent) => void;

/** Sort into session order: by session, then by sequence. */
export function sortEvents(events: StudyEvent[]): StudyEvent[] {
  return [...events].sort((a, b) => a.at.localeCompare(b.at) || a.seq - b.seq);
}
