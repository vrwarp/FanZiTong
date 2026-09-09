import { DEFAULT_SETTINGS, type ReviewLog, type UserSettings, type VocabCard } from '@/types';
import { makeCard, makeLog, reviewState } from '@/test/factories';
import type { StudyEvent } from './events';
import {
  buildActivity,
  buildCardReports,
  buildDeckCensus,
  buildDiagnostics,
  buildReport,
  inferSessions,
  quantiles,
  summarizeRecordedSessions,
} from './report';

const settings: UserSettings = { ...DEFAULT_SETTINGS, maxDailyNewCards: 10, leechThreshold: 3 };

function at(minutes: number): string {
  return new Date(Date.UTC(2026, 8, 7, 8, minutes)).toISOString();
}

let seq = 0;
function answerEvent(overrides: Partial<StudyEvent>): StudyEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    sessionId: 's1',
    seq,
    at: at(seq),
    kind: 'answer',
    mode: 'daily',
    exerciseType: 'rapid_recognition',
    applied: true,
    ...overrides,
  };
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

describe('retries and recorded sessions', () => {
  const card = makeCard({ traditional: '傲嬌', fsrs: reviewState({ state: 1, stability: 0.2 }) });
  const logs = [makeLog({ cardId: card.id, rating: 1, reviewTimestamp: at(0), stateBefore: 0 })];
  const events: StudyEvent[] = [
    { id: 'start', sessionId: 's1', seq: 0, at: at(0), kind: 'session_start', mode: 'daily' },
    answerEvent({ cardId: card.id, rating: 1, correct: false }),
    answerEvent({ cardId: card.id, rating: 1, correct: false, applied: false, retry: true }),
    answerEvent({ cardId: card.id, rating: 2, correct: true, applied: false, retry: true }),
    answerEvent({
      cardId: card.id,
      rating: 3,
      correct: true,
      applied: false,
      retry: true,
      exerciseType: 'foil_discrimination',
    }),
    {
      id: 'end',
      sessionId: 's1',
      seq: 9,
      at: at(9),
      kind: 'session_end',
      mode: 'daily',
      completed: true,
    },
  ];

  it('counts retries per day, per exercise and per card, from events alone', () => {
    const activity = buildActivity(logs, events);
    expect(activity.retries).toEqual({
      total: 3,
      byExercise: { rapid_recognition: 2, cloze: 0, realia_menu: 0, foil_discrimination: 1 },
    });
    expect(activity.days[0].retries).toBe(3);
    expect(activity.days[0].answers).toBe(1); // the log, not the retries
    expect(buildCardReports([card], logs, settings, events)[0].retries).toBe(3);
  });

  it('summarizes recorded sessions with their retries and busiest card', () => {
    const sessions = summarizeRecordedSessions(events);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      sessionId: 's1',
      mode: 'daily',
      answers: 4,
      retries: 3,
      distinctCards: 1,
      completed: true,
      maxAnswersOnOneCard: 4,
      busiestCardId: card.id,
    });
    expect(buildActivity(logs, events).recordedSessions).toEqual(sessions);
  });

  it('reports the retries and sees a loop the review log cannot', () => {
    const loopEvents = [
      ...events,
      answerEvent({ cardId: card.id, rating: 1, applied: false, retry: true }),
      answerEvent({ cardId: card.id, rating: 1, applied: false, retry: true }),
    ];
    const found = buildReport([card], logs, settings, loopEvents).diagnostics;
    const retries = found.find((d) => d.code === 'same_day_retries')!;
    expect(retries.count).toBe(5);
    expect(retries.examples[0]).toContain('傲嬌');
    // Six answers on one card: invisible in the log (one row), plain in the events.
    expect(inferSessions(logs)[0].maxAnswersOnOneCard).toBe(1);
    expect(found.find((d) => d.code === 'in_session_repeat_loop')!.count).toBe(1);
  });
});

describe('the settling hold in the census and diagnostics', () => {
  const settling = Array.from({ length: 12 }, (_, i) =>
    makeCard({ traditional: `字${i}`, fsrs: reviewState({ stability: 0.3 }) }),
  );
  const fresh = makeCard({ traditional: '蛋餅' });

  it('counts settling words per domain and across the active domains', () => {
    const census = buildDeckCensus(
      [...settling, makeCard({ domain: 'church', fsrs: reviewState({ stability: 0.3 }) })],
      { ...settings, activeDomains: ['food'] },
    );
    expect(census.byDomain.find((d) => d.domain === 'food')!.settling).toBe(12);
    expect(census.byDomain.find((d) => d.domain === 'church')!.settling).toBe(1);
    expect(census.settlingCards).toBe(12);
  });

  it('warns when the hold has closed the door on new cards', () => {
    const found = buildReport([...settling, fresh], [], {
      ...settings,
      maxSettlingCards: 10,
    }).diagnostics;
    const hold = found.find((d) => d.code === 'settling_hold')!;
    expect(hold.severity).toBe('warn');
    expect(hold.detail).toContain('room for 0 new card(s)');
    expect(hold.examples).toHaveLength(5);
  });

  it('only notes a hold that leaves some room, and says nothing when there is nothing new', () => {
    const roomy = buildReport([...settling, fresh], [], {
      ...settings,
      maxSettlingCards: 15,
    }).diagnostics;
    expect(roomy.find((d) => d.code === 'settling_hold')!.severity).toBe('info');
    const nothingNew = buildReport(settling, [], { ...settings, maxSettlingCards: 10 }).diagnostics;
    expect(nothingNew.map((d) => d.code)).not.toContain('settling_hold');
  });

  it('warns when the hold is off and the settling pile is high', () => {
    const found = buildReport([...settling, ...settling, fresh], [], {
      ...settings,
      maxSettlingCards: 0,
      maxDailyNewCards: 10,
    }).diagnostics;
    expect(found.find((d) => d.code === 'settling_hold')!.title).toMatch(/no hold/);
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
