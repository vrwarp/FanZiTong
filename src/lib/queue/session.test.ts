import { DEFAULT_SETTINGS, type VocabCard } from '@/types';
import { makeCard, reviewState } from '@/test/factories';
import {
  buildSessionQueue,
  chooseDrillType,
  drillVerdict,
  hasClozeSentence,
  hasFoils,
  interleaveByDomain,
  isDrillCandidate,
  isRetry,
  isSettling,
  knockedDownToday,
  LEARN_AHEAD_MS,
  newCardCapacity,
  readToday,
  shouldRequeue,
} from './session';

const now = new Date('2026-09-05T08:00:00.000Z');

function dueCard(overrides: Partial<VocabCard> & { dueOffsetMs?: number } = {}): VocabCard {
  const { dueOffsetMs = -1000, ...rest } = overrides;
  return makeCard({
    fsrs: reviewState({ due: new Date(now.getTime() + dueOffsetMs).toISOString() }),
    ...rest,
  });
}

describe('buildSessionQueue', () => {
  it('puts due reviews (oldest first) before new cards (creation order)', () => {
    const late = dueCard({ id: 'late', dueOffsetMs: -1000 });
    const early = dueCard({ id: 'early', dueOffsetMs: -60_000 });
    const future = dueCard({ id: 'future', dueOffsetMs: 60_000 });
    const new2 = makeCard({ id: 'new2', createdAt: '2026-09-02T00:00:00.000Z' });
    const new1 = makeCard({ id: 'new1', createdAt: '2026-09-01T00:00:00.000Z' });
    const plan = buildSessionQueue({
      cards: [late, new2, future, early, new1],
      settings: DEFAULT_SETTINGS,
      now,
      reviewsDoneToday: 0,
      newCardsIntroducedToday: 0,
    });
    expect(plan.queue).toEqual(['early', 'late', 'new1', 'new2']);
    expect(plan.dueReviewCount).toBe(2);
    expect(plan.newCardCount).toBe(2);
    expect(plan.totalDueCount).toBe(2);
    expect(plan.estimatedMinutes).toBeGreaterThanOrEqual(1);
  });

  it('round-robins new cards across the active domains', () => {
    // The deck is authored in blocks: without interleaving, the daily limit
    // would be spent on food for weeks before church was ever offered.
    const cards = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeCard({
          id: `food${i}`,
          domain: 'food',
          createdAt: `2026-09-01T00:00:0${i}.000Z`,
        }),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        makeCard({
          id: `church${i}`,
          domain: 'church',
          createdAt: `2026-09-02T00:00:0${i}.000Z`,
        }),
      ),
    ];
    const plan = buildSessionQueue({
      cards,
      settings: { ...DEFAULT_SETTINGS, maxDailyNewCards: 6 },
      now,
      reviewsDoneToday: 0,
      newCardsIntroducedToday: 0,
    });
    expect(plan.queue).toEqual(['food0', 'church0', 'food1', 'church1', 'food2', 'food3']);
  });

  it('leaves a single-domain deck in creation order', () => {
    const cards = [
      makeCard({ id: 'b', createdAt: '2026-09-02T00:00:00.000Z' }),
      makeCard({ id: 'a', createdAt: '2026-09-01T00:00:00.000Z' }),
    ];
    expect(interleaveByDomain(cards).map((c) => c.id)).toEqual(['b', 'a']);
    const plan = buildSessionQueue({
      cards,
      settings: DEFAULT_SETTINGS,
      now,
      reviewsDoneToday: 0,
      newCardsIntroducedToday: 0,
    });
    expect(plan.queue).toEqual(['a', 'b']);
  });

  it('honours daily limits minus what was already done today', () => {
    const cards = [
      ...Array.from({ length: 5 }, (_, i) => dueCard({ id: `d${i}`, dueOffsetMs: -i * 1000 })),
      ...Array.from({ length: 5 }, (_, i) => makeCard({ id: `n${i}` })),
    ];
    const plan = buildSessionQueue({
      cards,
      settings: { ...DEFAULT_SETTINGS, maxDailyReviews: 4, maxDailyNewCards: 2 },
      now,
      reviewsDoneToday: 2,
      newCardsIntroducedToday: 1,
    });
    expect(plan.dueReviewCount).toBe(2);
    expect(plan.newCardCount).toBe(1);
    expect(plan.totalDueCount).toBe(5);
    expect(plan.totalNewCount).toBe(5);
  });

  it('holds new cards back while too many studied words are still settling', () => {
    // Twelve words met this week, none yet trusted for a day: with the hold at
    // ten there is no room for more, however high the daily limit is.
    const settling = Array.from({ length: 12 }, (_, i) =>
      makeCard({
        id: `s${i}`,
        fsrs: reviewState({ stability: 0.3, due: '2026-09-06T00:00:00.000Z' }),
      }),
    );
    const fresh = Array.from({ length: 5 }, (_, i) => makeCard({ id: `n${i}` }));
    const plan = buildSessionQueue({
      cards: [...settling, ...fresh],
      settings: { ...DEFAULT_SETTINGS, maxDailyNewCards: 20, maxSettlingCards: 10 },
      now,
      reviewsDoneToday: 0,
      newCardsIntroducedToday: 0,
    });
    expect(plan.settlingCount).toBe(12);
    expect(plan.newCardCount).toBe(0);
    expect(plan.newCardsHeldBack).toBe(5);
    expect(plan.queue).toEqual([]);

    // Room for three: the hold, not the daily limit, is the binding cap.
    const roomy = buildSessionQueue({
      cards: [...settling, ...fresh],
      settings: { ...DEFAULT_SETTINGS, maxDailyNewCards: 20, maxSettlingCards: 15 },
      now,
      reviewsDoneToday: 0,
      newCardsIntroducedToday: 0,
    });
    expect(roomy.newCardCount).toBe(3);
    expect(roomy.newCardsHeldBack).toBe(2);

    // 0 turns the hold off.
    const off = buildSessionQueue({
      cards: [...settling, ...fresh],
      settings: { ...DEFAULT_SETTINGS, maxDailyNewCards: 20, maxSettlingCards: 0 },
      now,
      reviewsDoneToday: 0,
      newCardsIntroducedToday: 0,
    });
    expect(off.newCardCount).toBe(5);
    expect(off.newCardsHeldBack).toBe(0);
  });

  it('counts settling words only among the active domains', () => {
    const cards = [
      makeCard({ id: 'food', fsrs: reviewState({ stability: 0.5 }) }),
      makeCard({ id: 'church', domain: 'church', fsrs: reviewState({ stability: 0.5 }) }),
      makeCard({ id: 'solid', fsrs: reviewState({ stability: 12 }) }),
    ];
    const plan = buildSessionQueue({
      cards,
      settings: { ...DEFAULT_SETTINGS, activeDomains: ['food'] },
      now,
      reviewsDoneToday: 0,
      newCardsIntroducedToday: 0,
    });
    expect(plan.settlingCount).toBe(1);
  });

  it('excludes inactive domains and never returns negative budgets', () => {
    const cards = [dueCard({ id: 'food' }), dueCard({ id: 'church', domain: 'church' })];
    const plan = buildSessionQueue({
      cards,
      settings: { ...DEFAULT_SETTINGS, activeDomains: ['church'], maxDailyReviews: 1 },
      now,
      reviewsDoneToday: 5,
      newCardsIntroducedToday: 0,
    });
    expect(plan.queue).toEqual([]);
    expect(plan.totalDueCount).toBe(1);
  });
});

describe('requeue and drill helpers', () => {
  it('requeues cards due within the learn-ahead window', () => {
    expect(shouldRequeue(new Date(now.getTime() + 60_000).toISOString(), now)).toBe(true);
    expect(shouldRequeue(new Date(now.getTime() + LEARN_AHEAD_MS).toISOString(), now)).toBe(true);
    expect(shouldRequeue(new Date(now.getTime() + LEARN_AHEAD_MS + 1).toISOString(), now)).toBe(
      false,
    );
  });

  it('identifies drill candidates', () => {
    expect(isDrillCandidate(makeCard())).toBe(false);
    expect(isDrillCandidate(makeCard({ fsrs: reviewState({ state: 1 }) }))).toBe(true);
    expect(isDrillCandidate(makeCard({ fsrs: reviewState({ state: 3 }) }))).toBe(true);
    expect(isDrillCandidate(makeCard({ fsrs: reviewState({ lapses: 2 }) }))).toBe(true);
  });

  it('checks cloze and foil availability', () => {
    expect(hasClozeSentence(makeCard())).toBe(true);
    expect(hasClozeSentence(makeCard({ exampleSentenceTraditional: '沒有目標詞。' }))).toBe(false);
    expect(hasClozeSentence(makeCard({ exampleSentenceTraditional: undefined }))).toBe(false);
    expect(hasFoils(makeCard())).toBe(true);
    expect(hasFoils(makeCard({ visualFoils: [' '] }))).toBe(false);
  });

  it('rotates drill types and falls back sensibly', () => {
    const food = makeCard();
    expect(chooseDrillType(food, undefined)).toBe('cloze');
    expect(chooseDrillType(food, 'cloze')).toBe('realia_menu');
    expect(chooseDrillType(food, 'realia_menu')).toBe('cloze');
    const church = makeCard({ domain: 'church', exampleSentenceTraditional: undefined });
    expect(chooseDrillType(church, undefined)).toBe('foil_discrimination');
    expect(chooseDrillType(church, 'foil_discrimination')).toBe('foil_discrimination');
    const bare = makeCard({
      domain: 'slang',
      exampleSentenceTraditional: undefined,
      visualFoils: [],
    });
    expect(chooseDrillType(bare, undefined)).toBeNull();
  });
});

describe('settling and the one-Again-a-day rule', () => {
  it('calls a studied word settling until it is stable for a day', () => {
    expect(isSettling(makeCard())).toBe(false); // never studied
    expect(isSettling(makeCard({ fsrs: reviewState({ state: 1, stability: 0.2 }) }))).toBe(true);
    expect(isSettling(makeCard({ fsrs: reviewState({ stability: 0.99 }) }))).toBe(true);
    expect(isSettling(makeCard({ fsrs: reviewState({ stability: 1 }) }))).toBe(false);
  });

  it('leaves room for new cards under the hold, and no cap when it is off', () => {
    expect(newCardCapacity({ maxSettlingCards: 20 }, 5)).toBe(15);
    expect(newCardCapacity({ maxSettlingCards: 20 }, 25)).toBe(0);
    expect(newCardCapacity({ maxSettlingCards: 0 }, 999)).toBe(Number.POSITIVE_INFINITY);
  });

  it('treats a second miss on the same study day as a retry, but not a pass', () => {
    const morning = new Date(2026, 8, 5, 8, 0);
    const evening = new Date(2026, 8, 5, 22, 0);
    const afterMidnight = new Date(2026, 8, 6, 0, 30);
    const nextDay = new Date(2026, 8, 6, 5, 0);
    const card = { lastAgainAt: morning.toISOString() };
    expect(knockedDownToday(card, evening)).toBe(true);
    // The day turns over at 4 a.m.: half past midnight is still this evening.
    expect(knockedDownToday(card, afterMidnight)).toBe(true);
    expect(knockedDownToday(card, afterMidnight, 0)).toBe(false);
    expect(knockedDownToday(card, nextDay)).toBe(false);
    expect(knockedDownToday({}, evening)).toBe(false);
    expect(isRetry(card, 1, evening)).toBe(true);
    expect(isRetry(card, 2, evening)).toBe(true);
    expect(isRetry(card, 3, evening)).toBe(false);
    expect(isRetry(card, 4, evening)).toBe(false);
    expect(isRetry(card, 1, nextDay)).toBe(false);
  });

  it('knows when a word has been read today', () => {
    const morning = new Date(2026, 8, 5, 8, 0);
    const evening = new Date(2026, 8, 5, 22, 0);
    const nextDay = new Date(2026, 8, 6, 8, 0);
    expect(readToday({ lastPassAt: morning.toISOString() }, evening)).toBe(true);
    expect(readToday({ lastPassAt: morning.toISOString() }, nextDay)).toBe(false);
    expect(readToday({}, evening)).toBe(false);
  });
});

describe('what a drill may do to a word', () => {
  const now = new Date(2026, 8, 5, 22, 0);
  const earlier = new Date(2026, 8, 5, 8, 0).toISOString();
  const yesterday = new Date(2026, 8, 4, 8, 0).toISOString();

  it('moves a word still being learned, unless it already had its verdict today', () => {
    const learning = makeCard({ fsrs: reviewState({ state: 1, stability: 0.3 }) });
    expect(drillVerdict(learning, false, now)).toBe('again');
    expect(drillVerdict(learning, true, now)).toBe('good');
    expect(drillVerdict({ ...learning, lastAgainAt: earlier }, false, now)).toBe('practice');
    expect(drillVerdict({ ...learning, lastAgainAt: earlier }, true, now)).toBe('practice');
    expect(drillVerdict({ ...learning, lastPassAt: earlier }, false, now)).toBe('practice');
    expect(drillVerdict({ ...learning, lastPassAt: earlier }, true, now)).toBe('practice');
    // Yesterday's verdict is spent.
    expect(drillVerdict({ ...learning, lastAgainAt: yesterday }, false, now)).toBe('again');
    expect(drillVerdict({ ...learning, lastPassAt: yesterday }, true, now)).toBe('good');
    // A never-seen word in a standalone drill is graded like a learning one.
    expect(drillVerdict(makeCard(), false, now)).toBe('again');
  });

  it('never moves a word in Review: a hit changes nothing and a miss books a reading', () => {
    const review = makeCard({ fsrs: reviewState() });
    expect(drillVerdict(review, true, now)).toBe('unchanged');
    expect(drillVerdict(review, false, now)).toBe('book');
    expect(drillVerdict({ ...review, lastPassAt: earlier }, false, now)).toBe('book');
    // Knocked down today in recognition: the miss is practice, the reading is already booked.
    expect(drillVerdict({ ...review, lastAgainAt: earlier }, false, now)).toBe('practice');
    // Relearning is still learning.
    const relearning = makeCard({ fsrs: reviewState({ state: 3, lapses: 1 }) });
    expect(drillVerdict(relearning, false, now)).toBe('again');
  });
});
