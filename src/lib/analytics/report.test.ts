import { DEFAULT_SETTINGS, type ReviewLog, type UserSettings, type VocabCard } from '@/types';
import { makeCard, makeLog, reviewState } from '@/test/factories';
import {
  buildActivity,
  buildCardReports,
  buildDeckCensus,
  buildDiagnostics,
  buildReport,
  inferSessions,
  quantiles,
} from './report';

const settings: UserSettings = { ...DEFAULT_SETTINGS, maxDailyNewCards: 10, leechThreshold: 3 };

function at(minutes: number): string {
  return new Date(Date.UTC(2026, 8, 7, 8, minutes)).toISOString();
}

describe('quantiles', () => {
  it('is empty for no values', () => {
    expect(quantiles([])).toEqual({ n: 0, p50: null, p90: null, max: null });
  });

  it('uses nearest rank', () => {
    expect(quantiles([10, 20, 30, 40, 50])).toEqual({ n: 5, p50: 30, p90: 50, max: 50 });
  });
});

describe('buildDeckCensus', () => {
  const cards: VocabCard[] = [
    makeCard({ traditional: '滷肉飯', domain: 'food', createdAt: '2026-09-01T00:00:00.000Z' }),
    makeCard({ traditional: '牛肉麵', domain: 'food', createdAt: '2026-09-01T00:00:01.000Z' }),
    makeCard({ traditional: '火鍋', domain: 'food', createdAt: '2026-09-01T00:00:02.000Z' }),
    makeCard({ traditional: '團契', domain: 'church', createdAt: '2026-09-01T00:00:03.000Z' }),
    makeCard({ traditional: '禱告', domain: 'church', createdAt: '2026-09-01T00:00:04.000Z' }),
  ];

  it('counts states, content and what has been seen', () => {
    const census = buildDeckCensus(cards, settings);
    expect(census.totalCards).toBe(5);
    expect(census.neverSeenCards).toBe(5);
    const food = census.byDomain.find((d) => d.domain === 'food')!;
    expect(food.total).toBe(3);
    expect(food.states.new).toBe(3);
    expect(food.content.withSentence).toBe(3);
    expect(census.byDomain.find((d) => d.domain === 'slang')!.total).toBe(0);
  });

  it('previews the upcoming new cards in the order the queue would use them', () => {
    // The deck is authored food-first; the preview must show the interleaving.
    const census = buildDeckCensus(cards, settings);
    expect(census.newQueueAhead.every((run) => run.count === 1)).toBe(true);
    expect(census.newQueueAhead.map((r) => r.domain)).toEqual([
      'food',
      'church',
      'food',
      'church',
      'food',
    ]);
  });

  it('leaves inactive domains out of the preview', () => {
    const census = buildDeckCensus(cards, { ...settings, activeDomains: ['food'] });
    expect(census.newQueueAhead).toEqual([{ domain: 'food', count: 3 }]);
  });
});

describe('inferSessions', () => {
  it('splits on a long gap and names the card that took the most answers', () => {
    const logs: ReviewLog[] = [
      makeLog({ cardId: 'a', reviewTimestamp: at(0) }),
      makeLog({ cardId: 'b', reviewTimestamp: at(1) }),
      makeLog({ cardId: 'b', reviewTimestamp: at(2) }),
      // Two hours later: a different session.
      makeLog({ cardId: 'c', reviewTimestamp: at(140) }),
    ];
    const sessions = inferSessions(logs);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].answers).toBe(3);
    expect(sessions[0].distinctCards).toBe(2);
    expect(sessions[0].maxAnswersOnOneCard).toBe(2);
    expect(sessions[0].busiestCardId).toBe('b');
    expect(sessions[1].answers).toBe(1);
    expect(sessions[1].busiestCardId).toBeNull();
  });

  it('has nothing to say about no answers', () => {
    expect(inferSessions([])).toEqual([]);
  });
});

describe('buildActivity', () => {
  const logs: ReviewLog[] = [
    makeLog({ cardId: 'a', rating: 4, reviewTimestamp: at(0), timeSpentMs: 1000, stateBefore: 0 }),
    makeLog({ cardId: 'b', rating: 1, reviewTimestamp: at(1), timeSpentMs: 5000, stateBefore: 0 }),
    makeLog({
      cardId: 'b',
      rating: 1,
      exerciseType: 'foil_discrimination',
      reviewTimestamp: at(2),
      timeSpentMs: 9000,
      stateBefore: 2,
    }),
  ];

  it('breaks answers down by day, rating, exercise and pre-answer state', () => {
    const activity = buildActivity(logs);
    expect(activity.totalAnswers).toBe(3);
    expect(activity.studyDays).toBe(1);
    expect(activity.days[0].newCardsIntroduced).toBe(2);
    expect(activity.days[0].distinctCards).toBe(2);
    expect(activity.days[0].ratings[1]).toBe(2);
    expect(activity.ratingsByExercise.foil_discrimination[1]).toBe(1);
    expect(activity.ratingsByStateBefore.review[1]).toBe(1);
    expect(activity.ratingsByStateBefore.new[4]).toBe(1);
    expect(activity.lapses).toEqual({
      total: 2,
      fromDrills: 1,
      byExercise: {
        rapid_recognition: 1,
        cloze: 0,
        realia_menu: 0,
        foil_discrimination: 1,
      },
    });
    expect(activity.latencyMsByExercise.rapid_recognition).toEqual({
      n: 2,
      p50: 1000,
      p90: 5000,
      max: 5000,
    });
  });
});

describe('buildCardReports', () => {
  it('reports only the cards that have been studied, worst first', () => {
    const studied = makeCard({ traditional: '貢丸湯', fsrs: reviewState({ reps: 4, lapses: 3 }) });
    const untouched = makeCard({ traditional: '蛋餅' });
    const logs = [
      makeLog({ cardId: studied.id, rating: 1, reviewTimestamp: at(0) }),
      makeLog({ cardId: studied.id, rating: 3, reviewTimestamp: at(30) }),
    ];
    const reports = buildCardReports([studied, untouched], logs, settings);
    expect(reports).toHaveLength(1);
    expect(reports[0].traditional).toBe('貢丸湯');
    expect(reports[0].answers).toBe(2);
    expect(reports[0].ratings[1]).toBe(1);
    expect(reports[0].history[1].hoursSincePrevious).toBe(0.5);
    expect(reports[0].flags).toContain('leech');
  });

  it('flags a card whose scheduler state has no history behind it', () => {
    const orphan = makeCard({ fsrs: reviewState({ reps: 2 }) });
    const reports = buildCardReports([orphan], [], settings);
    expect(reports[0].flags).toContain('history_missing');
  });
});

describe('buildDiagnostics', () => {
  it('finds a session that one card took over', () => {
    const card = makeCard({ traditional: '貢丸湯', fsrs: reviewState({ reps: 8, lapses: 1 }) });
    const logs = Array.from({ length: 8 }, (_, i) =>
      makeLog({ cardId: card.id, rating: 1, reviewTimestamp: at(i) }),
    );
    const found = buildReport([card], logs, settings).diagnostics;
    const loop = found.find((d) => d.code === 'in_session_repeat_loop')!;
    expect(loop.severity).toBe('high');
    expect(loop.detail).toContain('貢丸湯');
  });

  it('separates lapses charged by a multiple-choice drill', () => {
    const card = makeCard({ fsrs: reviewState({ reps: 2, lapses: 1 }) });
    const logs = [
      makeLog({
        cardId: card.id,
        rating: 1,
        exerciseType: 'foil_discrimination',
        stateBefore: 2,
        reviewTimestamp: at(0),
      }),
    ];
    const codes = buildReport([card], logs, settings).diagnostics.map((d) => d.code);
    expect(codes).toContain('guess_floor_lapse');
  });

  it('notices an active domain that has never been reached', () => {
    const cards = [
      makeCard({ domain: 'food', fsrs: reviewState({ reps: 3 }) }),
      makeCard({ domain: 'church' }),
    ];
    const logs = [makeLog({ cardId: cards[0].id, reviewTimestamp: at(0) })];
    const census = buildDeckCensus(cards, settings);
    const activity = buildActivity(logs);
    const found = buildDiagnostics(cards, logs, settings, census, activity);
    const starved = found.find((d) => d.code === 'domain_starvation')!;
    expect(starved.detail).toContain('church');
  });

  it('spots one duration written onto several cards at once', () => {
    const cards = [makeCard(), makeCard()];
    const stamp = at(0);
    const logs = cards.map((c) =>
      makeLog({
        cardId: c.id,
        exerciseType: 'realia_menu',
        reviewTimestamp: stamp,
        timeSpentMs: 24_711,
      }),
    );
    const found = buildReport(cards, logs, settings).diagnostics;
    expect(found.find((d) => d.code === 'shared_answer_timing')!.count).toBe(1);
  });

  it('says nothing about a deck nobody has studied yet', () => {
    const found = buildReport([makeCard()], [], settings).diagnostics;
    expect(found.map((d) => d.code)).not.toContain('in_session_repeat_loop');
    expect(found.map((d) => d.code)).not.toContain('leech');
  });
});
