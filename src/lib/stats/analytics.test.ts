import { createScheduler } from '@/lib/fsrs/scheduler';
import { makeCard, makeLog, reviewState } from '@/test/factories';
import {
  averageRetrievability,
  computeStreak,
  countDueByTomorrow,
  countNewCardsIntroducedToday,
  countReviewsToday,
  dailySeries,
  domainMastery,
  dueCount,
  findLeeches,
  retentionRate,
  stateDistribution,
  totalLapses,
} from './analytics';

// Local-time noon so day boundaries are unambiguous in any timezone.
const now = new Date(2026, 8, 5, 12, 0, 0);
const at = (daysAgo: number, hour = 10) => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

describe('daily counters', () => {
  it('counts reviews today and cards introduced today', () => {
    const logs = [
      makeLog({ cardId: 'a', reviewTimestamp: at(0) }),
      makeLog({ cardId: 'a', reviewTimestamp: at(0, 11) }),
      makeLog({ cardId: 'b', reviewTimestamp: at(1) }),
      makeLog({ cardId: 'b', reviewTimestamp: at(0) }),
      makeLog({ cardId: 'c', reviewTimestamp: at(0) }),
    ];
    expect(countReviewsToday(logs, now)).toBe(4);
    expect(countNewCardsIntroducedToday(logs, now)).toBe(2); // a and c; b was first seen yesterday
  });

  it('computes retention rate as non-Again share', () => {
    expect(retentionRate([])).toBeNull();
    expect(
      retentionRate([
        makeLog({ rating: 1 }),
        makeLog({ rating: 3 }),
        makeLog({ rating: 4 }),
        makeLog({ rating: 2 }),
      ]),
    ).toBe(0.75);
  });

  it('builds a 30-day series oldest first with nulls for empty days', () => {
    const logs = [
      makeLog({ rating: 1, reviewTimestamp: at(0) }),
      makeLog({ rating: 3, reviewTimestamp: at(0) }),
      makeLog({ reviewTimestamp: at(29) }),
    ];
    const series = dailySeries(logs, 30, now);
    expect(series).toHaveLength(30);
    expect(series[29]).toMatchObject({ total: 2, correct: 1, retention: 0.5 });
    expect(series[0].total).toBe(1);
    expect(series[1].retention).toBeNull();
    expect(
      dailySeries([makeLog({ reviewTimestamp: at(31) })], 30, now).every((p) => p.total === 0),
    ).toBe(true);
  });
});

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    const logs = [0, 1, 2].map((d) => makeLog({ reviewTimestamp: at(d) }));
    expect(computeStreak(logs, now)).toBe(3);
  });
  it('tolerates an unfinished today but breaks on a gap', () => {
    expect(
      computeStreak(
        [1, 2].map((d) => makeLog({ reviewTimestamp: at(d) })),
        now,
      ),
    ).toBe(2);
    expect(
      computeStreak(
        [2, 3].map((d) => makeLog({ reviewTimestamp: at(d) })),
        now,
      ),
    ).toBe(0);
    expect(
      computeStreak(
        [0, 2].map((d) => makeLog({ reviewTimestamp: at(d) })),
        now,
      ),
    ).toBe(1);
    expect(computeStreak([], now)).toBe(0);
  });
});

describe('card-level diagnostics', () => {
  const cards = [
    makeCard({ domain: 'food', fsrs: reviewState({ stability: 45, lapses: 3 }) }),
    makeCard({ domain: 'food', fsrs: reviewState({ stability: 12, lapses: 1 }) }),
    makeCard({ domain: 'church', fsrs: reviewState({ stability: 31, lapses: 5, state: 3 }) }),
    makeCard({ domain: 'church' }),
    makeCard({ domain: 'anime', fsrs: reviewState({ state: 1, due: '2020-01-01T00:00:00.000Z' }) }),
  ];

  it('computes domain mastery (stability > 30d)', () => {
    const mastery = Object.fromEntries(domainMastery(cards).map((m) => [m.domain, m]));
    expect(mastery.food).toMatchObject({ total: 2, mastered: 1, percent: 50 });
    expect(mastery.church).toMatchObject({ total: 2, mastered: 1, percent: 50 });
    expect(mastery.slang).toMatchObject({ total: 0, mastered: 0, percent: 0 });
  });

  it('finds leeches worst-first and totals lapses', () => {
    const leeches = findLeeches(cards, 3);
    expect(leeches.map((c) => c.fsrs.lapses)).toEqual([5, 3]);
    expect(findLeeches(cards, 6)).toEqual([]);
    expect(totalLapses(cards)).toBe(9);
  });

  it('summarizes states and due counts', () => {
    expect(stateDistribution(cards)).toEqual({ new: 1, learning: 1, review: 2, relearning: 1 });
    expect(dueCount(cards, now)).toBe(4);
  });

  it('averages retrievability over reviewed cards only', () => {
    const scheduler = createScheduler({ targetRetention: 0.9 }, { enableFuzz: false });
    expect(averageRetrievability(scheduler, [makeCard()], now)).toBeNull();
    const avg = averageRetrievability(scheduler, cards, now);
    expect(avg).not.toBeNull();
    expect(avg!).toBeGreaterThan(0);
    expect(avg!).toBeLessThanOrEqual(1);
  });
});

describe('countDueByTomorrow', () => {
  it('counts reviews due from now to the end of local tomorrow, never new cards', () => {
    const now = new Date(2026, 8, 5, 20, 0); // 20:00 local
    const at = (d: Date) => ({ ...makeCard({}), fsrs: { ...reviewState(), due: d.toISOString() } });
    const cards = [
      at(new Date(2026, 8, 5, 21, 0)), // later tonight
      at(new Date(2026, 8, 6, 23, 30)), // tomorrow, after the 24-hour mark
      at(new Date(2026, 8, 7, 0, 30)), // the day after: excluded
      at(new Date(2026, 8, 5, 19, 0)), // already due: excluded
      makeCard({}), // new: excluded
    ];
    expect(countDueByTomorrow(cards, now)).toBe(2);
  });
});
