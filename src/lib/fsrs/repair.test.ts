import { State } from 'ts-fsrs';
import { restartCard } from '@/lib/fsrs/restart';
import { DEFAULT_SETTINGS, type RatingGrade, type ReviewLog } from '@/types';
import {
  GONG_WAN_TANG_HISTORY,
  HUN_TUN_TANG_HISTORY,
  legacyScheduler,
  makeCard,
  reviewState,
  studyOldWay,
} from '@/test/factories';
import {
  CURRENT_RULE,
  reachesScheduler,
  repairSchedules,
  replayCard,
  replayMatches,
  RULES,
  schedulerFor,
} from './repair';

const gongWanTang = GONG_WAN_TANG_HISTORY;
const legacy = legacyScheduler();
const current = schedulerFor(CURRENT_RULE, DEFAULT_SETTINGS);

describe('reachesScheduler', () => {
  const morning = '2026-09-07T08:00:00.000Z';
  const later = '2026-09-07T09:00:00.000Z';
  const log = (rating: RatingGrade, exerciseType: ReviewLog['exerciseType'], at = later) => ({
    rating,
    exerciseType,
    reviewTimestamp: at,
  });
  const learning = reviewState({ state: 1, stability: 0.2 });

  it('under the once-a-day rule, holds back same-day misses and drill answers after an Again', () => {
    const rule = RULES[1];
    const knocked = { fsrs: learning, lastAgainAt: morning };
    expect(reachesScheduler(knocked, log(1, 'rapid_recognition'), rule)).toBe(false);
    expect(reachesScheduler(knocked, log(2, 'rapid_recognition'), rule)).toBe(false);
    expect(reachesScheduler(knocked, log(3, 'rapid_recognition'), rule)).toBe(true);
    expect(reachesScheduler(knocked, log(3, 'foil_discrimination'), rule)).toBe(false);
    expect(reachesScheduler(knocked, log(1, 'foil_discrimination'), rule)).toBe(false);
    expect(reachesScheduler({ fsrs: learning }, log(1, 'rapid_recognition'), rule)).toBe(true);
    expect(reachesScheduler({ fsrs: learning }, log(3, 'foil_discrimination'), rule)).toBe(true);
    const nextDay = '2026-09-08T09:00:00.000Z';
    expect(reachesScheduler(knocked, log(1, 'cloze', nextDay), rule)).toBe(true);
    // Rule 1 counted midnight days: half past midnight was a new day.
    const afterMidnight = '2026-09-08T00:30:00.000Z';
    expect(reachesScheduler(knocked, log(1, 'rapid_recognition', afterMidnight), rule)).toBe(true);
  });

  it('under the rules in force, lets only a reading move a word in Review', () => {
    const review = { fsrs: reviewState() };
    expect(reachesScheduler(review, log(1, 'foil_discrimination'))).toBe(false);
    expect(reachesScheduler(review, log(3, 'foil_discrimination'))).toBe(false);
    expect(reachesScheduler(review, log(1, 'rapid_recognition'))).toBe(true);
    expect(reachesScheduler(review, log(3, 'rapid_recognition'))).toBe(true);
    // A word still being learned is moved by a drill, unless it was read today.
    expect(reachesScheduler({ fsrs: learning }, log(1, 'cloze'))).toBe(true);
    expect(reachesScheduler({ fsrs: learning, lastPassAt: morning }, log(1, 'cloze'))).toBe(false);
    // The day turns over at 4 a.m. now: half past midnight is the same day.
    const afterMidnight = '2026-09-08T00:30:00.000Z';
    expect(
      reachesScheduler(
        { fsrs: learning, lastAgainAt: morning },
        log(1, 'rapid_recognition', afterMidnight),
      ),
    ).toBe(false);
    // Rule 0 hears everything.
    expect(reachesScheduler(review, log(1, 'foil_discrimination'), RULES[0])).toBe(true);
  });

  it('under the rules in force, hears Hard once a day, and the day’s first Again after it', () => {
    const hardOnce = { fsrs: learning, lastHardAt: morning };
    expect(reachesScheduler(hardOnce, log(2, 'rapid_recognition'))).toBe(false);
    expect(reachesScheduler(hardOnce, log(1, 'rapid_recognition'))).toBe(true);
    expect(reachesScheduler(hardOnce, log(3, 'rapid_recognition'))).toBe(true);
    const nextDay = '2026-09-08T09:00:00.000Z';
    expect(reachesScheduler(hardOnce, log(2, 'rapid_recognition', nextDay))).toBe(true);
    // Rule 2 kept no record of a Hard, so it heard every one.
    expect(reachesScheduler(hardOnce, log(2, 'rapid_recognition'), RULES[2])).toBe(true);
  });
});

/**
 * 抓耙仔 on one learner's phone: a first sight failed, a Hard the next day,
 * then three Hards inside thirteen minutes and a Good, all applied. The
 * stacked Hards took the word from difficulty 8.8 to 9.9.
 */
const STACKED_HARDS = [
  { at: '2026-09-22T16:00:00.000Z', rating: 1 as RatingGrade },
  { at: '2026-09-23T16:00:00.000Z', rating: 2 as RatingGrade },
  { at: '2026-09-24T16:17:00.000Z', rating: 2 as RatingGrade },
  { at: '2026-09-24T16:21:00.000Z', rating: 2 as RatingGrade },
  { at: '2026-09-24T16:28:00.000Z', rating: 2 as RatingGrade },
  { at: '2026-09-24T16:30:00.000Z', rating: 3 as RatingGrade },
];

describe('replayCard — Hard once a day', () => {
  it('replays the second and third same-day Hards as retries, and the difficulty comes down', () => {
    const { card, logs } = studyOldWay(makeCard({ traditional: '抓耙仔' }), STACKED_HARDS);
    const readingOnly = replayCard(card, logs, schedulerFor(RULES[2], DEFAULT_SETTINGS), RULES[2]);
    expect(readingOnly.skipped).toEqual([]);
    const ruled = replayCard(card, logs, current, CURRENT_RULE);
    expect(ruled.skipped.map((l) => l.reviewTimestamp)).toEqual([
      '2026-09-24T16:21:00.000Z',
      '2026-09-24T16:28:00.000Z',
    ]);
    expect(ruled.fsrs.reps).toBe(4);
    expect(ruled.fsrs.difficulty).toBeLessThan(readingOnly.fsrs.difficulty - 0.5);
    expect(ruled.lastHardAt).toBe('2026-09-24T16:17:00.000Z');
    expect(readingOnly.lastHardAt).toBeUndefined();
  });

  it('replays a word started over from its restart', () => {
    const studied = studyOldWay(makeCard({ traditional: '踹共' }), STACKED_HARDS);
    const restarted = restartCard(studied.card, new Date('2026-09-25T00:00:00.000Z'));
    // Nothing since the restart: nothing to replay, and nothing to repair.
    expect(repairSchedules([restarted], studied.logs, DEFAULT_SETTINGS)).toEqual({
      repaired: [],
      annotated: [],
      unverifiable: 0,
    });
    // One answer since: the replay starts from new at the restart.
    const after = studyOldWay(restarted, [{ at: '2026-09-26T08:00:00.000Z', rating: 3 }], current);
    const replay = replayCard(after.card, [...studied.logs, ...after.logs], current, CURRENT_RULE);
    expect(replay.fsrs.reps).toBe(1);
    expect(replay.skipped).toEqual([]);
    expect(replayMatches(after.card, replay)).toBe(true);
  });
});

describe('replayCard', () => {
  it('reproduces the stored state exactly when every answer is applied the old way', () => {
    const { card, logs } = studyOldWay(makeCard({ traditional: '貢丸湯' }), gongWanTang);
    const faithful = replayCard(card, logs, legacy, RULES[0]);
    expect(faithful.skipped).toEqual([]);
    expect(faithful.fsrs.stability).toBeCloseTo(card.fsrs.stability, 6);
    expect(faithful.fsrs.difficulty).toBeCloseTo(card.fsrs.difficulty, 6);
    expect(faithful.fsrs.lapses).toBe(3);
    expect(replayMatches(card, faithful)).toBe(true);
    // The loop did what the analytics said it did.
    expect(card.fsrs.difficulty).toBeGreaterThan(9.5);
  });

  it('under the once-a-day rule, charges one Again a day and lets the card off the ceiling', () => {
    const { card, logs } = studyOldWay(makeCard({ traditional: '貢丸湯' }), gongWanTang);
    const ruled = replayCard(card, logs, legacy, RULES[1]);
    // Day 1: three retry Agains and nine retry Hards. Day 2: the menu hit
    // after the lapse, and the whole evening foil run (two misses, two hits).
    expect(ruled.skipped).toHaveLength(3 + 9 + 1 + 4);
    expect(ruled.fsrs.lapses).toBe(1);
    expect(ruled.fsrs.difficulty).toBeLessThan(9);
    expect(ruled.fsrs.difficulty).toBeGreaterThan(card.fsrs.difficulty - 4);
    expect(ruled.fsrs.reps).toBe(logs.length - ruled.skipped.length);
    expect(ruled.lastAgainAt).toBe('2026-09-08T13:58:49.000Z');
    expect(ruled.lastPassAt).toBe('2026-09-08T14:01:16.000Z');
  });

  it('under the rules in force, the day-two miss lands on a word still at its three-hour step', () => {
    const { card, logs } = studyOldWay(makeCard({ traditional: '貢丸湯' }), gongWanTang);
    const ruled = replayCard(card, logs, current, CURRENT_RULE);
    expect(ruled.skipped).toHaveLength(3 + 9 + 1 + 4);
    // Failed while still being learned: a failed step, not a lapse.
    expect(ruled.fsrs.lapses).toBe(0);
    expect(ruled.fsrs.difficulty).toBeLessThan(9.5);
  });

  it('lets 餛飩湯 off the hook: no lapses, because both were drills the reading contradicted', () => {
    const { card, logs } = studyOldWay(makeCard({ traditional: '餛飩湯' }), HUN_TUN_TANG_HISTORY);
    expect(card.fsrs.lapses).toBe(2);
    expect(card.fsrs.difficulty).toBeGreaterThan(9.5);
    const ruled = replayCard(card, logs, current, CURRENT_RULE);
    // The day-one foil hit (read that day), the slip miss (Review) and the cloze miss (Review).
    expect(ruled.skipped.map((l) => l.exerciseType)).toEqual([
      'foil_discrimination',
      'realia_menu',
      'cloze',
    ]);
    expect(ruled.fsrs.lapses).toBe(0);
    expect(ruled.fsrs.state).toBe(State.Review);
    expect(ruled.fsrs.difficulty).toBeLessThan(6.5);
    expect(ruled.fsrs.stability).toBeGreaterThan(6);
  });

  it('replays a history with the learning steps of its rule', () => {
    // Good, then Good ten minutes later: graduated under the legacy steps,
    // still learning (a three-hour step away) under the current ones.
    const { card, logs } = studyOldWay(makeCard({ traditional: '便當' }), [
      { at: '2026-09-07T08:00:00.000Z', rating: 3 },
      { at: '2026-09-07T08:10:00.000Z', rating: 3 },
    ]);
    expect(card.fsrs.state).toBe(State.Review);
    expect(replayMatches(card, replayCard(card, logs, legacy, RULES[0]))).toBe(true);
    const ruled = replayCard(card, logs, current, CURRENT_RULE);
    expect(ruled.fsrs.state).toBe(State.Learning);
    expect(replayMatches(card, ruled)).toBe(false);
  });

  it('does not match a card whose history is missing answers', () => {
    const { card, logs } = studyOldWay(makeCard(), gongWanTang);
    const partial = replayCard(card, logs.slice(0, 5), legacy, RULES[0]);
    expect(replayMatches(card, partial)).toBe(false);
  });
});

describe('repairSchedules', () => {
  it('repairs looped cards, annotates the rest, and leaves unverifiable history alone', () => {
    const looped = studyOldWay(makeCard({ traditional: '貢丸湯' }), gongWanTang);
    const clean = studyOldWay(makeCard({ traditional: '滷肉飯' }), [
      { at: '2026-09-07T08:00:00.000Z', rating: 1 },
      { at: '2026-09-08T08:00:00.000Z', rating: 3 },
      { at: '2026-09-09T08:00:00.000Z', rating: 4 },
    ]);
    const known = studyOldWay(makeCard({ traditional: '便當' }), [
      { at: '2026-09-07T08:00:00.000Z', rating: 4 },
    ]);
    const orphan = { ...clean.card, id: 'orphan', fsrs: { ...clean.card.fsrs, difficulty: 3 } };
    const orphanLogs = clean.logs.map((l, i) => ({ ...l, id: `o${i}`, cardId: 'orphan' }));
    const untouched = makeCard({ traditional: '蛋餅' });

    const result = repairSchedules(
      [looped.card, clean.card, known.card, orphan, untouched],
      [...looped.logs, ...clean.logs, ...known.logs, ...orphanLogs],
      DEFAULT_SETTINGS,
    );
    expect(result.repaired.map((r) => r.card.traditional)).toEqual(['貢丸湯']);
    expect(result.repaired[0].skipped).toBe(17);
    expect(result.repaired[0].after.difficulty).toBeLessThan(result.repaired[0].before.difficulty);
    expect(result.repaired[0].card.lastAgainAt).toBe('2026-09-08T13:58:49.000Z');
    // Nothing changed for 滷肉飯 and 便當, but their verdicts are now on record.
    expect(result.annotated.map((c) => c.traditional)).toEqual(['滷肉飯', '便當']);
    expect(result.annotated[0].lastAgainAt).toBe('2026-09-07T08:00:00.000Z');
    expect(result.annotated[0].lastPassAt).toBe('2026-09-09T08:00:00.000Z');
    expect(result.annotated[0].fsrs).toEqual(clean.card.fsrs);
    expect(result.annotated[1].lastPassAt).toBe('2026-09-07T08:00:00.000Z');
    // The orphan's state has no history behind it; 蛋餅 was never studied.
    expect(result.unverifiable).toBe(1);
  });

  it('accepts a card the once-a-day repair already rewrote, and moves it on', () => {
    const looped = studyOldWay(makeCard({ traditional: '貢丸湯' }), gongWanTang);
    const v1 = replayCard(looped.card, looped.logs, legacy, RULES[1]);
    const repairedOnce = { ...looped.card, fsrs: v1.fsrs, lastAgainAt: v1.lastAgainAt };
    const result = repairSchedules([repairedOnce], looped.logs, DEFAULT_SETTINGS);
    expect(result.unverifiable).toBe(0);
    expect(result.repaired).toHaveLength(1);
    expect(result.repaired[0].after.lapses).toBe(0);
  });

  it('accepts a card the reading-only repair already rewrote, and moves it on to rule 3', () => {
    const stacked = studyOldWay(makeCard({ traditional: '抓耙仔' }), STACKED_HARDS);
    const v2 = replayCard(
      stacked.card,
      stacked.logs,
      schedulerFor(RULES[2], DEFAULT_SETTINGS),
      RULES[2],
    );
    const repairedTwice = {
      ...stacked.card,
      fsrs: v2.fsrs,
      lastAgainAt: v2.lastAgainAt,
      lastPassAt: v2.lastPassAt,
    };
    const result = repairSchedules([repairedTwice], stacked.logs, DEFAULT_SETTINGS);
    expect(result.unverifiable).toBe(0);
    expect(result.repaired).toHaveLength(1);
    expect(result.repaired[0].skipped).toBe(2);
    expect(result.repaired[0].card.lastHardAt).toBe('2026-09-24T16:17:00.000Z');
    expect(result.repaired[0].after.difficulty).toBeLessThan(result.repaired[0].before.difficulty);
  });

  it('is idempotent: a second pass has nothing left to do', () => {
    const looped = studyOldWay(makeCard({ traditional: '貢丸湯' }), gongWanTang);
    const first = repairSchedules([looped.card], looped.logs, DEFAULT_SETTINGS);
    const again = repairSchedules([first.repaired[0].card], looped.logs, DEFAULT_SETTINGS);
    expect(again.repaired).toEqual([]);
    expect(again.annotated).toEqual([]);
    expect(again.unverifiable).toBe(0);
  });
});
