import { createEmptyCard, type FSRS, type Grade } from 'ts-fsrs';
import { isRetry, knockedDownToday } from '@/lib/queue/session';
import type { FsrsState, ReviewLog, VocabCard } from '@/types';
import { fromFsrsCard, toFsrsCard } from './scheduler';

/** How close a replayed memory state must come to the stored one to count as the same history. */
export const REPLAY_TOLERANCE = 1e-4;

export interface Replay {
  /** The memory state the history produces under the rule in force. */
  fsrs: FsrsState;
  /** When the scheduler last heard Again, as the replay saw it. */
  lastAgainAt?: string;
  /** Logs the rule left out of the scheduler's view. */
  skipped: ReviewLog[];
}

/**
 * Whether one logged answer would have reached the scheduler under the
 * one-Again-a-day rule, given the card as the replay has it so far.
 *
 * Mirrors the engine: a same-day Again or Hard after an Again is a retry; a
 * drill hit on a word knocked down that day is practice; a recognition pass
 * always counts.
 */
export function reachesScheduler(
  card: Pick<VocabCard, 'lastAgainAt'>,
  log: Pick<ReviewLog, 'rating' | 'exerciseType' | 'reviewTimestamp'>,
): boolean {
  const at = new Date(log.reviewTimestamp);
  if (isRetry(card, log.rating, at)) return false;
  if (log.exerciseType !== 'rapid_recognition' && knockedDownToday(card, at)) return false;
  return true;
}

/**
 * Run a card's review history through the scheduler again.
 *
 * With `applyRule` off every answer is applied, which is how the stored state
 * was produced; with it on, the answers the one-Again-a-day rule would have
 * held back are skipped, and every later answer is scheduled from the state
 * that leaves. Stability and difficulty are deterministic; only the interval
 * carries fuzz, so a replay with fuzz off can be compared to the stored state.
 */
export function replayCard(
  card: VocabCard,
  logs: ReviewLog[],
  scheduler: FSRS,
  applyRule: boolean,
): Replay {
  const ordered = [...logs].sort((a, b) => a.reviewTimestamp.localeCompare(b.reviewTimestamp));
  let state = fromFsrsCard(createEmptyCard(new Date(card.createdAt)));
  let lastAgainAt: string | undefined;
  const skipped: ReviewLog[] = [];
  for (const log of ordered) {
    if (applyRule && !reachesScheduler({ lastAgainAt }, log)) {
      skipped.push(log);
      continue;
    }
    const at = new Date(log.reviewTimestamp);
    state = fromFsrsCard(scheduler.next(toFsrsCard(state), at, log.rating as Grade).card);
    if (log.rating === 1) lastAgainAt = log.reviewTimestamp;
  }
  return lastAgainAt ? { fsrs: state, lastAgainAt, skipped } : { fsrs: state, skipped };
}

/** Whether a replay reproduces the memory state the card carries. */
export function replayMatches(card: VocabCard, replay: Replay): boolean {
  const close = (a: number, b: number) =>
    Math.abs(a - b) <= REPLAY_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));
  return (
    replay.fsrs.state === card.fsrs.state &&
    replay.fsrs.reps === card.fsrs.reps &&
    replay.fsrs.lapses === card.fsrs.lapses &&
    close(replay.fsrs.stability, card.fsrs.stability) &&
    close(replay.fsrs.difficulty, card.fsrs.difficulty)
  );
}

export interface RepairedCard {
  card: VocabCard;
  before: FsrsState;
  after: FsrsState;
  /** Answers the scheduler no longer counts. */
  skipped: number;
}

export interface RepairResult {
  /** Cards whose schedule changed. */
  repaired: RepairedCard[];
  /** Cards that only gained a record of their last Again. */
  annotated: VocabCard[];
  /** Studied cards whose history does not reproduce their state, left untouched. */
  unverifiable: number;
}

/**
 * Recompute the schedule of every studied card under the one-Again-a-day rule.
 *
 * Before the rule, a never-seen word failed three times in three minutes was
 * pinned at maximum difficulty for good, and that verdict now taxes every
 * interval the word will ever get. The history is all there, so the repair
 * replays it: first with every answer, to prove the log really is the history
 * behind the stored state (a card that does not reproduce is left alone), then
 * under the rule, and the card takes the state the rule produces.
 */
export function repairSchedules(
  cards: VocabCard[],
  logs: ReviewLog[],
  scheduler: FSRS,
): RepairResult {
  const byCard = new Map<string, ReviewLog[]>();
  for (const log of logs) {
    const list = byCard.get(log.cardId);
    if (list) list.push(log);
    else byCard.set(log.cardId, [log]);
  }
  const result: RepairResult = { repaired: [], annotated: [], unverifiable: 0 };
  for (const card of cards) {
    const history = byCard.get(card.id);
    if (!history || card.fsrs.reps === 0) continue;
    const faithful = replayCard(card, history, scheduler, false);
    if (!replayMatches(card, faithful)) {
      result.unverifiable += 1;
      continue;
    }
    const ruled = replayCard(card, history, scheduler, true);
    if (ruled.skipped.length > 0) {
      const repaired: VocabCard = { ...card, fsrs: ruled.fsrs };
      if (ruled.lastAgainAt) repaired.lastAgainAt = ruled.lastAgainAt;
      result.repaired.push({
        card: repaired,
        before: card.fsrs,
        after: ruled.fsrs,
        skipped: ruled.skipped.length,
      });
    } else if (ruled.lastAgainAt && card.lastAgainAt !== ruled.lastAgainAt) {
      result.annotated.push({ ...card, lastAgainAt: ruled.lastAgainAt });
    }
  }
  return result;
}
