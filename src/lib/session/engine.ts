import type { Card, FSRS, Grade, IPreview } from 'ts-fsrs';
import type { ClozeExercise } from '@/lib/exercises/cloze';
import { buildClozeExercise } from '@/lib/exercises/cloze';
import type { FoilExercise } from '@/lib/exercises/foil';
import { buildFoilExercise } from '@/lib/exercises/foil';
import type { MenuExercise } from '@/lib/exercises/menu';
import { buildMenuExercise, companionsFor } from '@/lib/exercises/menu';
import {
  fromFsrsCard,
  STUDY_DAY_CLOCK,
  toFsrsCard,
  type RatingPreview,
  type SchedulerClock,
} from '@/lib/fsrs/scheduler';
import {
  DRILL_EVERY_N_CARDS,
  MAX_SESSION_REQUEUES,
  MIN_RETRY_GAP_MS,
  chooseDrillType,
  drillVerdict,
  hasClozeSentence,
  isDrillCandidate,
  isRetry,
  knockedDownToday,
  shouldRequeue,
  type DrillVerdict,
} from '@/lib/queue/session';
import type { SessionMode, StudyEvent, StudyEventSink } from '@/lib/analytics/events';
import { uuid } from '@/lib/util/id';
import { type Rng } from '@/lib/util/random';
import { formatInterval, MINUTE_MS } from '@/lib/util/time';
import {
  CardState,
  type ExerciseType,
  type RatingGrade,
  type ReviewLog,
  type VocabCard,
} from '@/types';

export type DrillExercise = ClozeExercise | FoilExercise | MenuExercise;

/**
 * The most time one answer can add to the log, the summary and the day's
 * total. A phone in a pocket for three hours with a card on screen is not
 * three hours of reading; one real session on record reported 2 h 56 min for
 * six minutes of study. The event log keeps the raw latency for diagnosis.
 */
export const MAX_COUNTED_ANSWER_MS = 2 * MINUTE_MS;

/** The fields of an event that only the exercise that produced it can fill in. */
type AnswerDetail = Pick<
  StudyEvent,
  'correct' | 'picked' | 'misses' | 'revealLatencyMs' | 'foilSource' | 'foilStrategy'
>;

/** How long a step took: what is counted, and what actually elapsed. */
interface StepTiming {
  countedMs: number;
  rawMs: number;
}

export type SessionStep =
  | { kind: 'card'; cardId: string }
  | { kind: 'drill'; exercise: DrillExercise }
  /**
   * Every remaining card was answered moments ago and nothing else can fill
   * the gap: the session holds until `until` (ms) rather than serve a card
   * whose reading is still on the learner's retina. `waiting` says how many.
   */
  | { kind: 'wait'; until: number; waiting: number };

export interface DrillOutcome {
  cardId: string;
  correct: boolean;
  /**
   * False when the answer says nothing about the target's binding (e.g. the
   * learner read a real word correctly but it was not the one in the blank):
   * counted as an answer, no schedule change.
   */
  applyRating?: boolean;
  /** The wrong option the learner picked, for the analytics event log. */
  picked?: string;
  /** How many misses it took before the shape was found. */
  misses?: number;
}

export interface SessionResultEntry {
  cardId: string;
  rating: RatingGrade;
  exerciseType: ExerciseType;
  timeMs: number;
  timestamp: string;
  /** False when the answer was recorded for the session but did not change the FSRS schedule. */
  applied: boolean;
  /**
   * True for an answer the scheduler was not consulted on — a word that
   * already had its verdict today, or a word in Review missed in a drill: it
   * counts as a look at the word (unlike a slip's unstudied companion).
   */
  retry?: boolean;
}

/**
 * The state-only half of the drill verdict, for callers without a clock: a
 * miss is "Again", a hit is "Good" only for cards still being learned, and a
 * hit on a card already in Review changes nothing. `drillVerdict` in
 * lib/queue adds the day's rules — a word that already had its verdict today
 * is practised, and a Review word missed in a drill is booked a reading.
 */
export function drillRatingFor(card: VocabCard, correct: boolean): RatingGrade | null {
  if (!correct) return 1;
  return card.fsrs.state === CardState.Review ? null : 3;
}

export function describeDrillOutcome(
  card: VocabCard,
  correct: boolean,
  applyRating = true,
  now: Date = new Date(),
): string {
  if (!applyRating) return 'No change to its schedule — that was a reading of another word.';
  switch (drillVerdict(card, correct, now)) {
    case 'practice':
      // A pick minutes after the reveal is a memory of the screen; a second
      // miss the same day says nothing the first did not. Both are practice.
      if (knockedDownToday(card, now)) {
        return correct
          ? 'Practice — already counted today, so the schedule stays as it is.'
          : 'Practice — already counted as forgotten today; it comes back, but the schedule does not move again.';
      }
      return 'Practice — you read it earlier today, and the schedule follows your reading.';
    case 'again':
      return 'Again — it comes back sooner.';
    case 'good':
      return 'Good — moves it toward long-term review.';
    case 'unchanged':
      return 'In review 複習中 — no change; a miss would bring it back to read.';
    case 'book':
      return 'In review 複習中 — a drill does not move it; it comes back for another look, and only your reading counts.';
  }
}

/** What the caller must persist after an answer. */
export interface PersistedReview {
  card: VocabCard;
  log: ReviewLog;
}

export interface EngineOptions {
  /** Every card available for distractor generation (superset of the queue). */
  pool: VocabCard[];
  /** Ordered card ids for rapid recognition (daily session). */
  queue: string[];
  /** Pre-built drills to run first (standalone drill sessions). */
  drills?: DrillExercise[];
  scheduler: FSRS;
  /** What time the scheduler is told; the study-day clock unless a test says otherwise. */
  clock?: SchedulerClock;
  /** Interleave a contextual drill after every 5th answered card (daily session). */
  interleaveDrills: boolean;
  /**
   * Re-show cards still in (re)learning later in this session (learn-ahead),
   * up to `MAX_SESSION_REQUEUES` times per card.
   * Defaults to `interleaveDrills`, i.e. on for daily sessions, off for standalone drills.
   */
  requeueLearning?: boolean;
  /** How long a card must wait after an answer before it is shown again. */
  retryGapMs?: number;
  now?: () => Date;
  rng?: Rng;
  /** Cache window in which the previewed schedule is reused for the actual rating. */
  previewReuseMs?: number;
  /** Progress of a session paused earlier today, so counts and time carry on. */
  restore?: SessionProgress;
  /** Stable id for this session; generated when the caller does not supply one. */
  sessionId?: string;
  /** Which drill a standalone session is running, for the event log. */
  drillType?: ExerciseType;
  /**
   * Receives one event per session boundary, answer and skip — including the
   * answers FSRS ignores, which never reach the review log.
   */
  onEvent?: StudyEventSink;
}

/** The part of a session worth carrying across a pause (see `serialize`). */
export interface SessionProgress {
  answered: number;
  results: SessionResultEntry[];
  /** Time already spent before the pause. */
  elapsedMs: number;
  drilled: string[];
  nextDrillAt: number;
  lastDrillType?: ExerciseType;
  /** Re-queue counts per card, so a resumed session cannot restart the loop. */
  requeues?: Record<string, number>;
  /** When each card was last answered (ms), so a resume cannot skip the gap. */
  answeredAt?: Record<string, number>;
  /** Cards a drill miss has already booked a reading for. */
  booked?: string[];
}

export interface EngineSnapshot {
  status: 'active' | 'complete';
  step: SessionStep | null;
  card: VocabCard | null;
  revealed: boolean;
  previews: Record<RatingGrade, RatingPreview> | null;
  /** Rapid-recognition answers so far. */
  answered: number;
  /** Cards still queued (excluding the current one). */
  remaining: number;
  /** answered + current + remaining — grows when cards are re-queued. */
  total: number;
  drillsRemaining: number;
  /** 1-based position among the session's pre-built drills (standalone mode). */
  drillIndex: number;
  drillTotal: number;
  /** Missed standalone items appended once more to the end of the drill queue. */
  requeued: number;
  results: SessionResultEntry[];
  startedAt: number;
  /** Time spent so far, frozen at completion. */
  elapsedMs: number;
  /** How long the learner looked at the prompt before revealing (current card). */
  revealLatencyMs: number | null;
}

/**
 * Framework-agnostic study session state machine.
 *
 * Owns the queue, the reveal/rate cycle, in-session re-queueing of cards
 * still in (re)learning, and drill interleaving. It never touches storage:
 * every answer returns the updated card + review log for the caller to save.
 */
export class StudyEngine {
  private readonly cards = new Map<string, VocabCard>();
  private readonly queue: string[];
  private readonly drillQueue: DrillExercise[];
  private drillTotal: number;
  private readonly requeuedDrills = new Set<string>();
  /** Times each card has been put back into the queue this session (see MAX_SESSION_REQUEUES). */
  private readonly requeues = new Map<string, number>();
  /** When each card was last answered this session (ms), for the retry gap. */
  private readonly answeredAt = new Map<string, number>();
  /** Cards a drill miss has booked a recognition look for (once each a session). */
  private readonly booked = new Set<string>();
  private readonly scheduler: FSRS;
  private readonly clock: SchedulerClock;
  private readonly interleave: boolean;
  private readonly requeueLearning: boolean;
  private readonly retryGapMs: number;
  private readonly now: () => Date;
  private readonly rng: Rng;
  private readonly previewReuseMs: number;
  private readonly sessionId: string;
  private readonly mode: SessionMode;
  private readonly drillType: ExerciseType | undefined;
  private readonly onEvent: StudyEventSink | undefined;
  private eventSeq = 0;
  private sessionEnded = false;
  /** Answers given per card this session, so an event can carry its repeat index. */
  private readonly answersByCard = new Map<string, number>();

  private status: 'active' | 'complete' = 'active';
  private step: SessionStep | null = null;
  private revealed = false;
  private revealLatencyMs: number | null = null;
  private preview: { at: number; log: IPreview } | null = null;
  private answered = 0;
  private nextDrillAt = DRILL_EVERY_N_CARDS;
  private lastDrillType: ExerciseType | undefined;
  private readonly drilled = new Set<string>();
  private readonly results: SessionResultEntry[] = [];
  /** Moves forward by the time a step spent past the cap, so elapsed time excludes it. */
  private startedAt: number;
  private stepStartedAt: number;
  private completedAt: number | null = null;
  private cached: EngineSnapshot | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(options: EngineOptions) {
    for (const card of options.pool) this.cards.set(card.id, card);
    this.queue = options.queue.filter((id) => this.cards.has(id));
    this.drillQueue = [...(options.drills ?? [])];
    this.drillTotal = this.drillQueue.length;
    this.scheduler = options.scheduler;
    this.clock = options.clock ?? STUDY_DAY_CLOCK;
    this.interleave = options.interleaveDrills;
    this.requeueLearning = options.requeueLearning ?? options.interleaveDrills;
    this.retryGapMs = options.retryGapMs ?? MIN_RETRY_GAP_MS;
    this.now = options.now ?? (() => new Date());
    this.rng = options.rng ?? Math.random;
    this.previewReuseMs = options.previewReuseMs ?? 60_000;
    this.sessionId = options.sessionId ?? uuid();
    this.mode = options.interleaveDrills ? 'daily' : 'drill';
    this.drillType = options.drillType;
    this.onEvent = options.onEvent;
    const restore = options.restore;
    // A resumed session counts from where it stopped: the clock excludes the pause.
    this.startedAt = this.now().getTime() - (restore?.elapsedMs ?? 0);
    this.stepStartedAt = this.now().getTime();
    if (restore) {
      this.answered = restore.answered;
      this.results.push(...restore.results);
      for (const id of restore.drilled) this.drilled.add(id);
      for (const [id, count] of Object.entries(restore.requeues ?? {})) {
        this.requeues.set(id, count);
      }
      for (const [id, at] of Object.entries(restore.answeredAt ?? {})) {
        this.answeredAt.set(id, at);
      }
      for (const id of restore.booked ?? []) this.booked.add(id);
      this.nextDrillAt = restore.nextDrillAt;
      this.lastDrillType = restore.lastDrillType;
      for (const result of restore.results) {
        this.answersByCard.set(result.cardId, (this.answersByCard.get(result.cardId) ?? 0) + 1);
      }
    }
    this.emit({
      kind: 'session_start',
      planned: this.queue.length,
      plannedDrills: this.drillTotal,
      resumed: Boolean(restore),
    });
    this.advance();
  }

  /** Progress to persist across a pause; pair it with `remainingCardIds()`. */
  serialize(): SessionProgress {
    return {
      answered: this.answered,
      results: [...this.results],
      elapsedMs: this.now().getTime() - this.startedAt,
      drilled: Array.from(this.drilled),
      nextDrillAt: this.nextDrillAt,
      lastDrillType: this.lastDrillType,
      requeues: Object.fromEntries(this.requeues),
      answeredAt: Object.fromEntries(this.answeredAt),
      booked: Array.from(this.booked),
    };
  }

  /** Subscribe to changes (external-store contract for React's useSyncExternalStore). */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Immutable view of the session; the same object is returned until something changes. */
  snapshot = (): EngineSnapshot => {
    if (this.cached) return this.cached;
    const card = this.step?.kind === 'card' ? (this.cards.get(this.step.cardId) ?? null) : null;
    this.cached = {
      status: this.status,
      step: this.step,
      card,
      revealed: this.revealed,
      previews: this.revealed && this.preview ? this.toPreviews(this.preview) : null,
      answered: this.answered,
      remaining: this.queue.length,
      total: this.answered + (this.step?.kind === 'card' ? 1 : 0) + this.queue.length,
      drillsRemaining: this.drillQueue.length,
      drillIndex: this.drillTotal - this.drillQueue.length,
      drillTotal: this.drillTotal,
      requeued: this.requeuedDrills.size,
      results: [...this.results],
      startedAt: this.startedAt,
      elapsedMs: (this.completedAt ?? this.now().getTime()) - this.startedAt,
      revealLatencyMs: this.revealLatencyMs,
    };
    return this.cached;
  };

  /** Current in-memory state of every card in the pool. */
  getCards(): VocabCard[] {
    return Array.from(this.cards.values());
  }

  getCard(id: string): VocabCard | undefined {
    return this.cards.get(id);
  }

  /** Ids of the cards still to be answered, current card first (for resume). */
  remainingCardIds(): string[] {
    const current = this.step?.kind === 'card' ? [this.step.cardId] : [];
    return [...current, ...this.queue];
  }

  /** Flip the recognition card: compute the four scheduling previews. */
  reveal(): void {
    if (this.step?.kind !== 'card' || this.revealed) return;
    const card = this.cards.get(this.step.cardId)!;
    const now = this.now();
    this.preview = {
      at: now.getTime(),
      log: this.scheduler.repeat(toFsrsCard(card.fsrs, this.clock), this.clock.toScheduler(now)),
    };
    this.revealed = true;
    this.revealLatencyMs = Math.max(0, now.getTime() - this.stepStartedAt);
    this.touch();
  }

  /**
   * Rate the current recognition card. Returns what to persist, or null when
   * the answer was a retry on a word already knocked down today: recorded, and
   * the card comes back, but nothing changed.
   */
  rate(rating: RatingGrade): PersistedReview | null {
    if (this.step?.kind !== 'card') throw new Error('No recognition card is active.');
    if (!this.revealed) this.reveal();
    const cardId = this.step.cardId;
    const card = this.cards.get(cardId)!;
    const now = this.now();
    const timing = this.takeStepTiming(now);
    const detail: Pick<StudyEvent, 'correct' | 'revealLatencyMs'> = { correct: rating !== 1 };
    if (this.revealLatencyMs !== null) detail.revealLatencyMs = this.revealLatencyMs;
    let persisted: PersistedReview | null = null;
    if (isRetry(card, rating, now)) {
      this.recordPractice(card, rating, 'rapid_recognition', now, timing, detail, 'retry');
    } else {
      const cached =
        this.preview && now.getTime() - this.preview.at <= this.previewReuseMs
          ? this.preview.log[rating as Grade]
          : null;
      persisted = this.applyRating(
        cardId,
        rating,
        'rapid_recognition',
        now,
        timing,
        cached?.card,
        detail,
      );
    }
    this.answered += 1;
    this.revealed = false;
    this.revealLatencyMs = null;
    this.preview = null;
    this.advance();
    this.touch();
    return persisted;
  }

  /**
   * Report the outcome of the active drill. What each answer does to the
   * schedule is `drillVerdict`'s call: a miss is "Again" and a hit "Good"
   * only for a word still being learned that has not had its verdict today;
   * a hit on a word in Review changes nothing; a miss on a word in Review
   * books a recognition look, because a word in Review is moved only by
   * reading.
   */
  answerDrill(outcomes: DrillOutcome[]): PersistedReview[] {
    if (this.step?.kind !== 'drill') throw new Error('No drill is active.');
    const exerciseType = this.step.exercise.type;
    const now = this.now();
    // One exercise, one duration: a slip grades several cards at once.
    const timing = this.takeStepTiming(now);
    const persisted: PersistedReview[] = [];
    for (const outcome of outcomes) {
      const card = this.cards.get(outcome.cardId);
      if (!card) continue;
      // A companion dish the learner has never studied is only there to fill the
      // slip: its answer is recorded, but the schedule is not touched.
      const companion =
        this.interleave && exerciseType === 'realia_menu' && card.fsrs.state === CardState.New;
      const verdict: DrillVerdict =
        outcome.applyRating === false || companion
          ? 'unchanged'
          : drillVerdict(card, outcome.correct, now);
      const detail = this.answerDetail(outcome.correct, outcome);
      switch (verdict) {
        case 'again':
        case 'good':
          persisted.push(
            this.applyRating(
              card.id,
              verdict === 'again' ? 1 : 3,
              exerciseType,
              now,
              timing,
              undefined,
              detail,
            ),
          );
          break;
        case 'practice':
          this.recordPractice(
            card,
            outcome.correct ? 3 : 1,
            exerciseType,
            now,
            timing,
            detail,
            'retry',
          );
          break;
        case 'book':
          if (this.interleave) this.bookLook(card.id);
          this.recordPractice(card, 1, exerciseType, now, timing, detail, 'booked');
          break;
        case 'unchanged':
          this.results.push({
            cardId: card.id,
            rating: outcome.correct ? 3 : 2,
            exerciseType,
            timeMs: timing.countedMs,
            timestamp: now.toISOString(),
            applied: false,
          });
          this.answeredAt.set(card.id, now.getTime());
          // The review log never sees this answer, because FSRS did not act on
          // it. Without the event there would be no record that it happened.
          this.emit({
            kind: 'answer',
            cardId: card.id,
            exerciseType,
            applied: false,
            latencyMs: timing.rawMs,
            repeatIndex: this.bumpAnswerCount(card.id),
            stateBefore: card.fsrs.state,
            stateAfter: card.fsrs.state,
            stabilityBefore: card.fsrs.stability,
            difficultyBefore: card.fsrs.difficulty,
            ...detail,
          });
          break;
      }
    }
    // In a standalone drill a missed item comes back once before the end: the
    // learner should leave having found the shape, not having been told it.
    if (!this.interleave) {
      const pool = Array.from(this.cards.values());
      for (const outcome of outcomes) {
        if (outcome.correct || outcome.applyRating === false) continue;
        const card = this.cards.get(outcome.cardId);
        if (!card || this.requeuedDrills.has(card.id)) continue;
        const again = this.buildExercise(exerciseType, card, pool);
        if (!again) continue;
        this.requeuedDrills.add(card.id);
        this.drillQueue.push(again);
        this.drillTotal += 1;
      }
    }
    this.advance();
    this.touch();
    return persisted;
  }

  /** Skip the active drill without rating anything. */
  skipDrill(): void {
    if (this.step?.kind !== 'drill') return;
    const exercise = this.step.exercise;
    const timing = this.takeStepTiming(this.now());
    this.emit({
      kind: 'drill_skip',
      exerciseType: exercise.type,
      cardId: exercise.type === 'realia_menu' ? exercise.cardIds[0] : exercise.cardId,
      latencyMs: timing.rawMs,
    });
    this.advance();
    this.touch();
  }

  /**
   * Re-check a waiting session: once the gap has passed the next card is
   * served. Harmless to call at any other time.
   */
  tick(): void {
    if (this.step?.kind !== 'wait') return;
    if (this.now().getTime() < this.step.until) return;
    this.advance();
    this.touch();
  }

  /** End the session early. */
  finish(): void {
    if (this.status === 'complete') return;
    this.status = 'complete';
    this.step = null;
    this.revealed = false;
    this.completedAt = this.now().getTime();
    this.endSession(false);
    this.touch();
  }

  // ---- internals -------------------------------------------------------

  /** Stamp and forward one event; the caller decides whether to store it. */
  private emit(fields: Partial<StudyEvent> & Pick<StudyEvent, 'kind'>): void {
    if (!this.onEvent) return;
    const event: StudyEvent = {
      id: uuid(),
      sessionId: this.sessionId,
      seq: this.eventSeq,
      at: this.now().toISOString(),
      mode: this.mode,
      ...fields,
    };
    this.eventSeq += 1;
    if (this.drillType) event.drillType = this.drillType;
    this.onEvent(event);
  }

  private endSession(completed: boolean): void {
    if (this.sessionEnded) return;
    this.sessionEnded = true;
    this.emit({
      kind: 'session_end',
      completed,
      answered: this.results.length,
      elapsedMs: (this.completedAt ?? this.now().getTime()) - this.startedAt,
    });
  }

  /**
   * How long the current step took, once per step. Time past the cap is a
   * phone in a pocket, not reading: it is left out of what is counted and
   * out of the session's elapsed time, and kept as the raw latency.
   */
  private takeStepTiming(now: Date): StepTiming {
    const rawMs = Math.max(0, now.getTime() - this.stepStartedAt);
    const countedMs = Math.min(rawMs, MAX_COUNTED_ANSWER_MS);
    this.startedAt += rawMs - countedMs;
    // Guard against a second reading of the same step (a slip grades several cards).
    this.stepStartedAt = now.getTime();
    return { countedMs, rawMs };
  }

  /** Answers this card has had before now, and count this one. */
  private bumpAnswerCount(cardId: string): number {
    const seen = this.answersByCard.get(cardId) ?? 0;
    this.answersByCard.set(cardId, seen + 1);
    return seen;
  }

  private touch(): void {
    this.cached = null;
    for (const listener of this.listeners) listener();
  }

  /** What only the exercise knows: whether it was right, and what was picked. */
  private answerDetail(correct: boolean, outcome?: DrillOutcome): AnswerDetail {
    const detail: AnswerDetail = { correct };
    if (outcome?.picked !== undefined) detail.picked = outcome.picked;
    if (outcome?.misses !== undefined) detail.misses = outcome.misses;
    // Which confusion was on screen is a property of the set, not the answer,
    // so it comes from the active exercise rather than the outcome.
    const exercise = this.step?.kind === 'drill' ? this.step.exercise : null;
    if (exercise?.type === 'foil_discrimination') {
      detail.foilSource = exercise.source;
      detail.foilStrategy = exercise.strategy;
    }
    return detail;
  }

  /** The earliest moment a card may be shown again, given its last answer this session. */
  private readyAt(cardId: string): number {
    const last = this.answeredAt.get(cardId);
    return last === undefined ? 0 : last + this.retryGapMs;
  }

  /** Put a card back into the queue for later in this session, within its allowance. */
  private requeue(card: VocabCard, now: Date): void {
    const requeuesSoFar = this.requeues.get(card.id) ?? 0;
    if (
      this.requeueLearning &&
      requeuesSoFar < MAX_SESSION_REQUEUES &&
      shouldRequeue(card.fsrs.due, now) &&
      !this.queue.includes(card.id)
    ) {
      this.requeues.set(card.id, requeuesSoFar + 1);
      this.queue.push(card.id);
    }
  }

  /**
   * A drill miss on a word in Review books one recognition look this session,
   * after the minute, outside the re-queue allowance and the learn-ahead
   * window: the look is what the scheduler will hear about the word.
   */
  private bookLook(cardId: string): void {
    if (this.booked.has(cardId)) return;
    this.booked.add(cardId);
    if (!this.queue.includes(cardId)) this.queue.push(cardId);
  }

  /**
   * An answer the scheduler is not consulted on: recorded for the session and
   * the event log, the card put back for one more look where the learn-ahead
   * window allows, and the schedule left exactly as it was. `reason` says
   * why: the word already had its verdict today (`retry`), or a word in
   * Review was missed in a drill and a reading is booked instead (`booked`).
   */
  private recordPractice(
    card: VocabCard,
    rating: RatingGrade,
    exerciseType: ExerciseType,
    now: Date,
    timing: StepTiming,
    detail: AnswerDetail,
    reason: 'retry' | 'booked',
  ): void {
    this.results.push({
      cardId: card.id,
      rating,
      exerciseType,
      timeMs: timing.countedMs,
      timestamp: now.toISOString(),
      applied: false,
      retry: true,
    });
    this.answeredAt.set(card.id, now.getTime());
    this.emit({
      kind: 'answer',
      cardId: card.id,
      exerciseType,
      rating,
      applied: false,
      ...(reason === 'retry' ? { retry: true } : { booked: true }),
      latencyMs: timing.rawMs,
      repeatIndex: this.bumpAnswerCount(card.id),
      stateBefore: card.fsrs.state,
      stateAfter: card.fsrs.state,
      stabilityBefore: card.fsrs.stability,
      stabilityAfter: card.fsrs.stability,
      difficultyBefore: card.fsrs.difficulty,
      difficultyAfter: card.fsrs.difficulty,
      scheduledDaysAfter: card.fsrs.scheduled_days,
      elapsedDaysBefore: card.fsrs.elapsed_days,
      ...detail,
    });
    this.requeue(card, now);
  }

  private applyRating(
    cardId: string,
    rating: RatingGrade,
    exerciseType: ExerciseType,
    now: Date,
    timing: StepTiming,
    precomputed?: Card,
    detail?: AnswerDetail,
  ): PersistedReview {
    const card = this.cards.get(cardId)!;
    const nextCard =
      precomputed ??
      this.scheduler.next(
        toFsrsCard(card.fsrs, this.clock),
        this.clock.toScheduler(now),
        rating as Grade,
      ).card;
    const next = fromFsrsCard(nextCard, this.clock);
    const nowIso = now.toISOString();
    const updated: VocabCard = { ...card, fsrs: next, updatedAt: nowIso };
    // The one Again a day the scheduler hears; everything after it is a retry.
    if (rating === 1) updated.lastAgainAt = nowIso;
    // The day's reading, after which a drill can no longer move the word.
    if (rating >= 3 && exerciseType === 'rapid_recognition') updated.lastPassAt = nowIso;
    this.cards.set(cardId, updated);
    const log: ReviewLog = {
      id: uuid(),
      cardId,
      rating,
      exerciseType,
      reviewTimestamp: nowIso,
      timeSpentMs: timing.countedMs,
      stateBefore: card.fsrs.state,
      stability: next.stability,
      difficulty: next.difficulty,
      scheduled_days: next.scheduled_days,
      lapses: next.lapses,
    };
    this.results.push({
      cardId,
      rating,
      exerciseType,
      timeMs: log.timeSpentMs,
      timestamp: nowIso,
      applied: true,
    });
    this.answeredAt.set(cardId, now.getTime());
    this.emit({
      kind: 'answer',
      cardId,
      exerciseType,
      rating,
      applied: true,
      latencyMs: timing.rawMs,
      repeatIndex: this.bumpAnswerCount(cardId),
      stateBefore: card.fsrs.state,
      stateAfter: next.state,
      stabilityBefore: card.fsrs.stability,
      stabilityAfter: next.stability,
      difficultyBefore: card.fsrs.difficulty,
      difficultyAfter: next.difficulty,
      scheduledDaysAfter: next.scheduled_days,
      elapsedDaysBefore: card.fsrs.elapsed_days,
      ...(detail ?? { correct: rating !== 1 }),
    });
    this.requeue(updated, now);
    return { card: updated, log };
  }

  private advance(): void {
    const nowMs = this.now().getTime();
    this.stepStartedAt = nowMs;
    if (this.status === 'complete') return;
    if (this.drillQueue.length > 0) {
      this.step = { kind: 'drill', exercise: this.drillQueue.shift()! };
      return;
    }
    if (this.interleave && this.answered >= this.nextDrillAt) {
      this.nextDrillAt = this.answered + DRILL_EVERY_N_CARDS;
      const drill = this.makeDrill();
      if (drill) {
        this.step = { kind: 'drill', exercise: drill };
        return;
      }
    }
    if (this.queue.length > 0) {
      // First in, first out — among the cards whose gap has passed.
      const index = this.queue.findIndex((id) => this.readyAt(id) <= nowMs);
      if (index >= 0) {
        const [cardId] = this.queue.splice(index, 1);
        this.step = { kind: 'card', cardId };
        return;
      }
      // Everything left was answered moments ago. A drill on another word
      // fills the gap usefully; failing that, the session waits it out.
      if (this.interleave) {
        const drill = this.makeDrill(new Set(this.queue));
        if (drill) {
          this.nextDrillAt = this.answered + DRILL_EVERY_N_CARDS;
          this.step = { kind: 'drill', exercise: drill };
          return;
        }
      }
      const until = Math.min(...this.queue.map((id) => this.readyAt(id)));
      this.step = { kind: 'wait', until, waiting: this.queue.length };
      return;
    }
    this.status = 'complete';
    this.step = null;
    this.completedAt = nowMs;
    this.endSession(true);
  }

  /**
   * Build the interleaved drill. A cloze on a sentence revealed minutes ago is
   * a memory of the screen, not a reading, so Fill the Blank only takes cards
   * still being learned that are NOT part of today's session; the cards seen
   * this session get Spot the Character or the Order Slip instead. Those ask
   * a different question from the reveal — which of these shapes is it — and
   * cannot advance a word knocked down today, so the minute between looks does
   * not apply to them; `exclude` is for the gap-filling drill, which must not
   * touch the very cards that are waiting out that minute.
   */
  private makeDrill(exclude: ReadonlySet<string> = new Set()): DrillExercise | null {
    const pool = Array.from(this.cards.values());
    const seenIds = new Set(this.results.map((r) => r.cardId));
    const queued = new Set(this.queue);
    const usable = (c: VocabCard) =>
      isDrillCandidate(c) && !this.drilled.has(c.id) && !exclude.has(c.id);

    if (this.lastDrillType !== 'cloze') {
      const fresh = pool
        .filter((c) => usable(c) && hasClozeSentence(c) && !seenIds.has(c.id) && !queued.has(c.id))
        .sort((a, b) => b.fsrs.lapses - a.fsrs.lapses || a.fsrs.stability - b.fsrs.stability);
      for (const card of fresh) {
        const exercise = this.buildExercise('cloze', card, pool);
        if (!exercise) continue;
        this.drilled.add(card.id);
        this.lastDrillType = 'cloze';
        return exercise;
      }
    }

    // Prefer a seen card that is not fresh in episodic memory (not in the last 3 answers).
    const recent = new Set(this.results.slice(-3).map((r) => r.cardId));
    const eligible = Array.from(seenIds)
      .map((id) => this.cards.get(id)!)
      .filter((c) => usable(c) && c.id !== this.queue[0]);
    const candidates = [
      ...eligible.filter((c) => !recent.has(c.id)),
      ...eligible.filter((c) => recent.has(c.id)),
    ].sort((a, b) => b.fsrs.lapses - a.fsrs.lapses);
    for (const card of candidates) {
      const type = chooseDrillType(card, this.lastDrillType, ['cloze']);
      if (!type) continue;
      const exercise = this.buildExercise(type, card, pool);
      if (!exercise) continue;
      this.drilled.add(card.id);
      this.lastDrillType = type;
      return exercise;
    }
    return null;
  }

  private buildExercise(
    type: Exclude<ExerciseType, 'rapid_recognition'>,
    card: VocabCard,
    pool: VocabCard[],
  ): DrillExercise | null {
    switch (type) {
      case 'cloze':
        return buildClozeExercise(card, pool, this.rng);
      case 'foil_discrimination':
        return buildFoilExercise(card, pool, this.rng);
      case 'realia_menu': {
        const seenIds = new Set(this.results.map((r) => r.cardId));
        const companions = companionsFor(card, pool)
          .sort((a, b) => Number(seenIds.has(b.id)) - Number(seenIds.has(a.id)))
          .slice(0, 2);
        return buildMenuExercise([card, ...companions], this.rng);
      }
      default:
        return null;
    }
  }

  private toPreviews(preview: { at: number; log: IPreview }): Record<RatingGrade, RatingPreview> {
    const at = new Date(preview.at);
    const out = {} as Record<RatingGrade, RatingPreview>;
    for (const rating of [1, 2, 3, 4] as const) {
      const item = preview.log[rating as Grade];
      const due = this.clock.fromScheduler(item.card.due);
      out[rating] = {
        rating,
        due,
        intervalLabel: formatInterval(at, due),
        scheduledDays: item.card.scheduled_days,
        state: item.card.state,
      };
    }
    return out;
  }
}

export function summarizeResults(results: SessionResultEntry[]) {
  const total = results.length;
  const correct = results.filter((r) => r.rating !== 1).length;
  const retries = results.filter((r) => r.retry).length;
  const firstByCard = new Map<string, SessionResultEntry>();
  // "Words seen" are the cards this session actually asked about: a graded
  // answer or a retry. A slip's unstudied companion dish or a cloze misread
  // is recorded but not counted.
  for (const r of results) {
    if ((r.applied || r.retry) && !firstByCard.has(r.cardId)) firstByCard.set(r.cardId, r);
  }
  const uniqueCards = firstByCard.size;
  const firstTryCorrect = Array.from(firstByCard.values()).filter((r) => r.rating !== 1).length;
  /** Cards whose first answer was Again or Hard — worth one more look. */
  const weakCardIds = Array.from(firstByCard.values())
    .filter((r) => r.rating <= 2)
    .map((r) => r.cardId);
  return {
    total,
    correct,
    uniqueCards,
    firstTryCorrect,
    weakCardIds,
    retries,
    retention: total === 0 ? null : correct / total,
  };
}
