import { DEFAULT_SETTINGS, type RatingGrade, type ReviewLog } from '@/types';
import { GONG_WAN_TANG_HISTORY, makeCard, studyOldWay as studyWith } from '@/test/factories';
import { createScheduler } from './scheduler';
import { reachesScheduler, repairSchedules, replayCard, replayMatches } from './repair';

const scheduler = createScheduler(DEFAULT_SETTINGS, { enableFuzz: false });
const studyOldWay = (
  card: Parameters<typeof studyWith>[0],
  answers: Parameters<typeof studyWith>[1],
) => studyWith(card, answers, scheduler);
const gongWanTang = GONG_WAN_TANG_HISTORY;

describe('reachesScheduler', () => {
  const morning = '2026-09-07T08:00:00.000Z';
  it('holds back same-day misses and drill hits after an Again, never a recognition pass', () => {
    const knocked = { lastAgainAt: morning };
    const later = '2026-09-07T09:00:00.000Z';
    const log = (rating: RatingGrade, exerciseType: ReviewLog['exerciseType']) => ({
      rating,
      exerciseType,
      reviewTimestamp: later,
    });
    expect(reachesScheduler(knocked, log(1, 'rapid_recognition'))).toBe(false);
    expect(reachesScheduler(knocked, log(2, 'rapid_recognition'))).toBe(false);
    expect(reachesScheduler(knocked, log(3, 'rapid_recognition'))).toBe(true);
    expect(reachesScheduler(knocked, log(3, 'foil_discrimination'))).toBe(false);
    expect(reachesScheduler(knocked, log(1, 'foil_discrimination'))).toBe(false);
    expect(reachesScheduler({}, log(1, 'rapid_recognition'))).toBe(true);
    expect(reachesScheduler({}, log(3, 'foil_discrimination'))).toBe(true);
    const nextDay = '2026-09-08T09:00:00.000Z';
    expect(
      reachesScheduler(knocked, { rating: 1, exerciseType: 'cloze', reviewTimestamp: nextDay }),
    ).toBe(true);
  });
});

describe('replayCard', () => {
  it('reproduces the stored state exactly when every answer is applied', () => {
    const { card, logs } = studyOldWay(makeCard({ traditional: '貢丸湯' }), gongWanTang);
    const faithful = replayCard(card, logs, scheduler, false);
    expect(faithful.skipped).toEqual([]);
    expect(faithful.fsrs.stability).toBeCloseTo(card.fsrs.stability, 6);
    expect(faithful.fsrs.difficulty).toBeCloseTo(card.fsrs.difficulty, 6);
    expect(faithful.fsrs.lapses).toBe(3);
    expect(replayMatches(card, faithful)).toBe(true);
    // The loop did what the analytics said it did.
    expect(card.fsrs.difficulty).toBeGreaterThan(9.5);
  });

  it('under the rule, charges one Again a day and lets the card off the difficulty ceiling', () => {
    const { card, logs } = studyOldWay(makeCard({ traditional: '貢丸湯' }), gongWanTang);
    const ruled = replayCard(card, logs, scheduler, true);
    // Day 1: three retry Agains and nine retry Hards. Day 2: the menu hit
    // after the lapse, and the whole evening foil run (two misses, two hits).
    expect(ruled.skipped).toHaveLength(3 + 9 + 1 + 4);
    expect(ruled.fsrs.lapses).toBe(1);
    expect(ruled.fsrs.difficulty).toBeLessThan(9);
    expect(ruled.fsrs.difficulty).toBeGreaterThan(card.fsrs.difficulty - 4);
    expect(ruled.fsrs.reps).toBe(logs.length - ruled.skipped.length);
    expect(ruled.lastAgainAt).toBe('2026-09-08T13:58:49.000Z');
  });

  it('does not match a card whose history is missing answers', () => {
    const { card, logs } = studyOldWay(makeCard(), gongWanTang);
    const partial = replayCard(card, logs.slice(0, 5), scheduler, false);
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
      scheduler,
    );
    expect(result.repaired.map((r) => r.card.traditional)).toEqual(['貢丸湯']);
    expect(result.repaired[0].skipped).toBe(17);
    expect(result.repaired[0].after.difficulty).toBeLessThan(result.repaired[0].before.difficulty);
    expect(result.repaired[0].card.lastAgainAt).toBe('2026-09-08T13:58:49.000Z');
    // Nothing was held back for 滷肉飯, but its last Again is now on record.
    expect(result.annotated.map((c) => c.traditional)).toEqual(['滷肉飯']);
    expect(result.annotated[0].lastAgainAt).toBe('2026-09-07T08:00:00.000Z');
    expect(result.annotated[0].fsrs).toEqual(clean.card.fsrs);
    // 便當 never lapsed and 蛋餅 was never studied: nothing to write.
    expect(result.unverifiable).toBe(1);
  });

  it('is idempotent: a second pass has nothing left to do', () => {
    const looped = studyOldWay(makeCard({ traditional: '貢丸湯' }), gongWanTang);
    const first = repairSchedules([looped.card], looped.logs, scheduler);
    const again = repairSchedules([first.repaired[0].card], looped.logs, scheduler);
    // The repaired state no longer reproduces from the full log, by design:
    // the log holds answers the scheduler now ignores. It is left alone.
    expect(again.repaired).toEqual([]);
    expect(again.annotated).toEqual([]);
    expect(again.unverifiable).toBe(1);
  });
});
