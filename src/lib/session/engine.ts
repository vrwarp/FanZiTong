import type { Card, FSRS, Grade, IPreview } from 'ts-fsrs';
import type { ClozeExercise } from '@/lib/exercises/cloze';
import { buildClozeExercise } from '@/lib/exercises/cloze';
import type { FoilExercise } from '@/lib/exercises/foil';
import { buildFoilExercise } from '@/lib/exercises/foil';
import type { MenuExercise } from '@/lib/exercises/menu';
import { buildMenuExercise } from '@/lib/exercises/menu';
import { fromFsrsCard, toFsrsCard, type RatingPreview } from '@/lib/fsrs/scheduler';
import {
  DRILL_EVERY_N_CARDS,
  chooseDrillType,
  isDrillCandidate,
  shouldRequeue,
} from '@/lib/queue/session';
import { uuid } from '@/lib/util/id';
import { type Rng } from '@/lib/util/random';
import { formatInterval } from '@/lib/util/time';
import {
  CardState,
  type ExerciseType,
  type RatingGrade,
  type ReviewLog,
  type VocabCard,
} from '@/types';

export type DrillExercise = ClozeExercise | FoilExercise | MenuExercise;

export type SessionStep =
  { kind: 'card'; cardId: string } | { kind: 'drill'; exercise: DrillExercise };

export interface DrillOutcome {
  cardId: string;
  correct: boolean;
}

export interface SessionResultEntry {
  cardId: string;
  rating: RatingGrade;
  exerciseType: ExerciseType;
  timeMs: number;
  timestamp: string;
  /** False when the answer was recorded for the session but did not change the FSRS schedule. */
  applied: boolean;
}

/**
 * Drills are recognition tasks with a guess floor, so they are weaker
 * evidence than a recall rating: a miss always counts as "Again", a hit
 * counts as "Good" only for cards still being learned, and leaves the
 * schedule of a card already in Review untouched.
 */
export function drillRatingFor(card: VocabCard, correct: boolean): RatingGrade | null {
  if (!correct) return 1;
  return card.fsrs.state === CardState.Review ? null : 3;
}

export function describeDrillOutcome(card: VocabCard, correct: boolean): string {
  const rating = drillRatingFor(card, correct);
  if (rating === 1) return 'Marked Again — this word will come back sooner.';
  if (rating === 3) return 'Marked Good — one step closer to graduating.';
  return 'Already in review — schedule unchanged.';
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
  /** Interleave a contextual drill after every 5th answered card (daily session). */
  interleaveDrills: boolean;
  /**
   * Re-show cards still in (re)learning later in this session (learn-ahead).
   * Defaults to `interleaveDrills`, i.e. on for daily sessions, off for standalone drills.
   */
  requeueLearning?: boolean;
  now?: () => Date;
  rng?: Rng;
  /** Cache window in which the previewed schedule is reused for the actual rating. */
  previewReuseMs?: number;
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
  private readonly scheduler: FSRS;
  private readonly interleave: boolean;
  private readonly requeueLearning: boolean;
  private readonly now: () => Date;
  private readonly rng: Rng;
  private readonly previewReuseMs: number;

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
  private readonly startedAt: number;
  private stepStartedAt: number;
  private completedAt: number | null = null;
  private cached: EngineSnapshot | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(options: EngineOptions) {
    for (const card of options.pool) this.cards.set(card.id, card);
    this.queue = options.queue.filter((id) => this.cards.has(id));
    this.drillQueue = [...(options.drills ?? [])];
    this.scheduler = options.scheduler;
    this.interleave = options.interleaveDrills;
    this.requeueLearning = options.requeueLearning ?? options.interleaveDrills;
    this.now = options.now ?? (() => new Date());
    this.rng = options.rng ?? Math.random;
    this.previewReuseMs = options.previewReuseMs ?? 60_000;
    this.startedAt = this.now().getTime();
    this.stepStartedAt = this.startedAt;
    this.advance();
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

  /** Flip the recognition card: compute the four scheduling previews. */
  reveal(): void {
    if (this.step?.kind !== 'card' || this.revealed) return;
    const card = this.cards.get(this.step.cardId)!;
    const now = this.now();
    this.preview = { at: now.getTime(), log: this.scheduler.repeat(toFsrsCard(card.fsrs), now) };
    this.revealed = true;
    this.revealLatencyMs = Math.max(0, now.getTime() - this.stepStartedAt);
    this.touch();
  }

  /** Rate the current recognition card. Returns what to persist. */
  rate(rating: RatingGrade): PersistedReview {
    if (this.step?.kind !== 'card') throw new Error('No recognition card is active.');
    if (!this.revealed) this.reveal();
    const cardId = this.step.cardId;
    const now = this.now();
    const cached =
      this.preview && now.getTime() - this.preview.at <= this.previewReuseMs
        ? this.preview.log[rating as Grade]
        : null;
    const persisted = this.applyRating(cardId, rating, 'rapid_recognition', now, cached?.card);
    this.answered += 1;
    this.revealed = false;
    this.revealLatencyMs = null;
    this.preview = null;
    this.advance();
    this.touch();
    return persisted;
  }

  /** Report the outcome of the active drill. Wrong picks rate "Again", right picks "Good". */
  answerDrill(outcomes: DrillOutcome[]): PersistedReview[] {
    if (this.step?.kind !== 'drill') throw new Error('No drill is active.');
    const exerciseType = this.step.exercise.type;
    const now = this.now();
    const persisted: PersistedReview[] = [];
    for (const outcome of outcomes) {
      const card = this.cards.get(outcome.cardId);
      if (!card) continue;
      const rating = drillRatingFor(card, outcome.correct);
      if (rating === null) {
        this.results.push({
          cardId: card.id,
          rating: 3,
          exerciseType,
          timeMs: Math.max(0, now.getTime() - this.stepStartedAt),
          timestamp: now.toISOString(),
          applied: false,
        });
        continue;
      }
      persisted.push(this.applyRating(card.id, rating, exerciseType, now));
    }
    this.advance();
    this.touch();
    return persisted;
  }

  /** Skip the active drill without rating anything. */
  skipDrill(): void {
    if (this.step?.kind !== 'drill') return;
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
    this.touch();
  }

  // ---- internals -------------------------------------------------------

  private touch(): void {
    this.cached = null;
    for (const listener of this.listeners) listener();
  }

  private applyRating(
    cardId: string,
    rating: RatingGrade,
    exerciseType: ExerciseType,
    now: Date,
    precomputed?: Card,
  ): PersistedReview {
    const card = this.cards.get(cardId)!;
    const nextCard =
      precomputed ?? this.scheduler.next(toFsrsCard(card.fsrs), now, rating as Grade).card;
    const next = fromFsrsCard(nextCard);
    const nowIso = now.toISOString();
    const updated: VocabCard = { ...card, fsrs: next, updatedAt: nowIso };
    this.cards.set(cardId, updated);
    const log: ReviewLog = {
      id: uuid(),
      cardId,
      rating,
      exerciseType,
      reviewTimestamp: nowIso,
      timeSpentMs: Math.max(0, now.getTime() - this.stepStartedAt),
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
    if (this.requeueLearning && shouldRequeue(next.due, now) && !this.queue.includes(cardId)) {
      this.queue.push(cardId);
    }
    return { card: updated, log };
  }

  private advance(): void {
    this.stepStartedAt = this.now().getTime();
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
      this.step = { kind: 'card', cardId: this.queue.shift()! };
      return;
    }
    this.status = 'complete';
    this.step = null;
    this.completedAt = this.now().getTime();
  }

  /** Build a drill for a card seen this session that is still in (re)learning or has lapsed. */
  private makeDrill(): DrillExercise | null {
    const seen = Array.from(new Set(this.results.map((r) => r.cardId)));
    // Prefer a card that is not fresh in episodic memory (not in the last 3 answers).
    const recent = new Set(this.results.slice(-3).map((r) => r.cardId));
    const eligible = seen
      .map((id) => this.cards.get(id)!)
      .filter((c) => isDrillCandidate(c) && !this.drilled.has(c.id) && c.id !== this.queue[0]);
    const candidates = [
      ...eligible.filter((c) => !recent.has(c.id)),
      ...eligible.filter((c) => recent.has(c.id)),
    ].sort((a, b) => b.fsrs.lapses - a.fsrs.lapses);
    const pool = Array.from(this.cards.values());
    for (const card of candidates) {
      const type = chooseDrillType(card, this.lastDrillType);
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
        const companions = pool
          .filter((c) => c.domain === 'food' && c.id !== card.id)
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
      out[rating] = {
        rating,
        due: item.card.due,
        intervalLabel: formatInterval(at, item.card.due),
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
  const firstByCard = new Map<string, SessionResultEntry>();
  for (const r of results) if (!firstByCard.has(r.cardId)) firstByCard.set(r.cardId, r);
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
    retention: total === 0 ? null : correct / total,
  };
}
