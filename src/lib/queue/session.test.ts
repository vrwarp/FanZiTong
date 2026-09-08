import { DEFAULT_SETTINGS, type VocabCard } from '@/types';
import { makeCard, reviewState } from '@/test/factories';
import {
  buildSessionQueue,
  chooseDrillType,
  hasClozeSentence,
  hasFoils,
  interleaveByDomain,
  isDrillCandidate,
  LEARN_AHEAD_MS,
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
