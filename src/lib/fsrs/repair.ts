import { createEmptyCard, type FSRS, type Grade, type StepUnit } from 'ts-fsrs';
import { drillVerdict, isRetry, knockedDownToday } from '@/lib/queue/session';
import { DAY_START_HOUR } from '@/lib/util/time';
import type { FsrsState, ReviewLog, UserSettings, VocabCard } from '@/types';
import {
  createScheduler,
  fromFsrsCard,
  LEARNING_STEPS,
  LEGACY_LEARNING_STEPS,
  LEGACY_RELEARNING_STEPS,
  RELEARNING_STEPS,
  STUDY_DAY_CLOCK,
  toFsrsCard,
  UTC_CLOCK,
  type SchedulerClock,
} from './scheduler';

/** How close a replayed memory state must come to the stored one to count as the same history. */
export const REPLAY_TOLERANCE = 1e-4;

/**
 * The rules a history can be read under, in the order the app adopted them.
 *
 * - 0: every logged answer reaches the scheduler, real time, days turning at
 *   midnight — how the app worked before any rule.
 * - 1: a word is knocked down at most once a day (same-day misses after an
 *   Again, and drill answers on a word knocked down that day, are held back);
 *   real time; midnight days.
 * - 2: rule 1, plus a word in Review is moved only by reading (a drill miss on
 *   it books a look instead of charging a lapse, and any drill answer on a
 *   word already read that day is practice); the scheduler is told the time
 *   in study days, which turn over at 4 a.m.; and a new word has a third
 *   learning step at three hours.
 *
 * A rule carries everything a replay needs to reproduce what the engine of
 * its day did — the clock, the day boundary and the learning steps — because
 * a stored state can only be proved to be the log's if it is recomputed the
 * way it was first computed.
 */
export type RuleVersion = 0 | 1 | 2;

export interface RuleSet {
  version: RuleVersion;
  clock: SchedulerClock;
  dayStartHour: number;
  learningSteps: readonly StepUnit[];
  relearningSteps: readonly StepUnit[];
}

const legacySteps = {
  learningSteps: LEGACY_LEARNING_STEPS,
  relearningSteps: LEGACY_RELEARNING_STEPS,
};

export const RULES: Record<RuleVersion, RuleSet> = {
  0: { version: 0, clock: UTC_CLOCK, dayStartHour: 0, ...legacySteps },
  1: { version: 1, clock: UTC_CLOCK, dayStartHour: 0, ...legacySteps },
  2: {
    version: 2,
    clock: STUDY_DAY_CLOCK,
    dayStartHour: DAY_START_HOUR,
    learningSteps: LEARNING_STEPS,
    relearningSteps: RELEARNING_STEPS,
  },
};

/** The rules in force. */
export const CURRENT_RULE: RuleSet = RULES[2];

/** A fuzz-free scheduler that steps the way a rule's engine did. */
export function schedulerFor(rule: RuleSet, settings: Pick<UserSettings, 'targetRetention'>): FSRS {
  return createScheduler(settings, {
    enableFuzz: false,
    learningSteps: rule.learningSteps,
    relearningSteps: rule.relearningSteps,
  });
}

export interface Replay {
  /** The memory state the history produces under the rule in force. */
  fsrs: FsrsState;
  /** When the scheduler last heard Again, as the replay saw it. */
  lastAgainAt?: string;
  /** When the scheduler last heard a recognition pass, as the replay saw it. */
  lastPassAt?: string;
  /** Logs the rule left out of the scheduler's view. */
  skipped: ReviewLog[];
}

/** The card as the replay knows it so far: its memory state and the day's verdicts. */
export type ReplayCard = Pick<VocabCard, 'fsrs' | 'lastAgainAt' | 'lastPassAt'>;

/**
 * Whether one logged answer would have reached the scheduler under a rule,
 * given the card as the replay has it so far. Mirrors the engine.
 */
export function reachesScheduler(
  card: ReplayCard,
  log: Pick<ReviewLog, 'rating' | 'exerciseType' | 'reviewTimestamp'>,
  rule: RuleSet = CURRENT_RULE,
): boolean {
  if (rule.version === 0) return true;
  const at = new Date(log.reviewTimestamp);
  if (log.exerciseType === 'rapid_recognition') {
    return !isRetry(card, log.rating, at, rule.dayStartHour);
  }
  if (rule.version === 1) return !knockedDownToday(card, at, rule.dayStartHour);
  const verdict = drillVerdict(card, log.rating !== 1, at, rule.dayStartHour);
  return verdict === 'again' || verdict === 'good';
}

/**
 * Run a card's review history through the scheduler again under a rule.
 *
 * Under rule 0 every answer is applied, which is how a state produced before
 * any rule came to be; under a later rule the answers it would have held
 * back are skipped, and every later answer is scheduled from the state that
 * leaves, on that rule's clock. Stability and difficulty are deterministic;
 * only the interval carries fuzz, so a replay with fuzz off can be compared
 * to the stored state.
 */
export function replayCard(
  card: VocabCard,
  logs: ReviewLog[],
  scheduler: FSRS,
  rule: RuleSet | boolean = CURRENT_RULE,
): Replay {
  const ruleSet = typeof rule === 'boolean' ? (rule ? RULES[1] : RULES[0]) : rule;
  const ordered = [...logs].sort((a, b) => a.reviewTimestamp.localeCompare(b.reviewTimestamp));
  let state = fromFsrsCard(createEmptyCard(new Date(card.createdAt)));
  let lastAgainAt: string | undefined;
  let lastPassAt: string | undefined;
  const skipped: ReviewLog[] = [];
  for (const log of ordered) {
    if (!reachesScheduler({ fsrs: state, lastAgainAt, lastPassAt }, log, ruleSet)) {
      skipped.push(log);
      continue;
    }
    const at = new Date(log.reviewTimestamp);
    state = fromFsrsCard(
      scheduler.next(
        toFsrsCard(state, ruleSet.clock),
        ruleSet.clock.toScheduler(at),
        log.rating as Grade,
      ).card,
      ruleSet.clock,
    );
    if (log.rating === 1) lastAgainAt = log.reviewTimestamp;
    if (log.rating >= 3 && log.exerciseType === 'rapid_recognition') {
      lastPassAt = log.reviewTimestamp;
    }
  }
  const replay: Replay = { fsrs: state, skipped };
  if (lastAgainAt) replay.lastAgainAt = lastAgainAt;
  if (lastPassAt) replay.lastPassAt = lastPassAt;
  return replay;
}

/** Whether a replay reproduces the memory state the card carries. */
export function replayMatches(card: VocabCard, replay: Replay): boolean {
  return statesMatch(card.fsrs, replay.fsrs);
}

function statesMatch(a: FsrsState, b: FsrsState): boolean {
  const close = (x: number, y: number) =>
    Math.abs(x - y) <= REPLAY_TOLERANCE * Math.max(1, Math.abs(x), Math.abs(y));
  return (
    a.state === b.state &&
    a.reps === b.reps &&
    a.lapses === b.lapses &&
    close(a.stability, b.stability) &&
    close(a.difficulty, b.difficulty)
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
  /** Cards that only gained a record of their last Again or last pass. */
  annotated: VocabCard[];
  /** Studied cards whose history does not reproduce their state, left untouched. */
  unverifiable: number;
}

/**
 * Recompute the schedule of every studied card under the rules in force.
 *
 * The history is all there, so the repair replays it: first under each rule
 * the card's stored state could have been made with — every answer applied,
 * the once-a-day rule, or the rules in force — to prove the log really is
 * the history behind the stored state (a card that reproduces under none of
 * them is left alone); then under the current rule and clock, and the card
 * takes the state that produces. A state that comes out the same only gains
 * the day's verdicts (`lastAgainAt`, `lastPassAt`) the engine now keeps.
 */
export function repairSchedules(
  cards: VocabCard[],
  logs: ReviewLog[],
  settings: Pick<UserSettings, 'targetRetention'>,
  options: { from?: RuleVersion[]; to?: RuleSet } = {},
): RepairResult {
  const from = options.from ?? [0, 1, 2];
  const to = options.to ?? CURRENT_RULE;
  const schedulers = new Map<RuleVersion, FSRS>();
  const schedulerOf = (rule: RuleSet) => {
    let scheduler = schedulers.get(rule.version);
    if (!scheduler) {
      scheduler = schedulerFor(rule, settings);
      schedulers.set(rule.version, scheduler);
    }
    return scheduler;
  };
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
    const faithful = from.some((version) =>
      replayMatches(card, replayCard(card, history, schedulerOf(RULES[version]), RULES[version])),
    );
    if (!faithful) {
      result.unverifiable += 1;
      continue;
    }
    const ruled = replayCard(card, history, schedulerOf(to), to);
    const next: VocabCard = { ...card, fsrs: ruled.fsrs };
    if (ruled.lastAgainAt) next.lastAgainAt = ruled.lastAgainAt;
    if (ruled.lastPassAt) next.lastPassAt = ruled.lastPassAt;
    if (!statesMatch(card.fsrs, ruled.fsrs)) {
      result.repaired.push({
        card: next,
        before: card.fsrs,
        after: ruled.fsrs,
        skipped: ruled.skipped.length,
      });
    } else if (card.lastAgainAt !== next.lastAgainAt || card.lastPassAt !== next.lastPassAt) {
      result.annotated.push({ ...next, fsrs: card.fsrs });
    }
  }
  return result;
}
