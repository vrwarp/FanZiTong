import { makeCard, makeLog, reviewState } from '@/test/factories';
import { CardState } from '@/types';
import { countSlipDays, isLeech, troubleScore } from './slips';

describe('slip days', () => {
  it('counts the study days a word was forgotten on, not its first sight or retries', () => {
    const card = makeCard();
    const logs = [
      // First sight: a miss, but not a slip.
      makeLog({
        cardId: card.id,
        rating: 1,
        stateBefore: CardState.New,
        reviewTimestamp: '2026-09-09T15:00:00.000Z',
      }),
      // Two misses the same evening — one day.
      makeLog({
        cardId: card.id,
        rating: 1,
        stateBefore: CardState.Learning,
        reviewTimestamp: '2026-09-10T15:00:00.000Z',
      }),
      makeLog({
        cardId: card.id,
        rating: 1,
        stateBefore: CardState.Learning,
        reviewTimestamp: '2026-09-10T22:00:00.000Z',
      }),
      // A pass, then a miss another day.
      makeLog({
        cardId: card.id,
        rating: 3,
        stateBefore: CardState.Learning,
        reviewTimestamp: '2026-09-11T15:00:00.000Z',
      }),
      makeLog({
        cardId: card.id,
        rating: 1,
        stateBefore: CardState.Review,
        reviewTimestamp: '2026-09-13T15:00:00.000Z',
      }),
      // A drill miss is not a reading.
      makeLog({
        cardId: card.id,
        rating: 1,
        exerciseType: 'foil_discrimination',
        stateBefore: CardState.Review,
        reviewTimestamp: '2026-09-14T15:00:00.000Z',
      }),
      // A log from before stateBefore existed still counts.
      makeLog({
        cardId: card.id,
        rating: 1,
        stateBefore: undefined,
        reviewTimestamp: '2026-09-15T15:00:00.000Z',
      }),
    ];
    expect(countSlipDays(logs).get(card.id)).toBe(3);
    expect(countSlipDays([]).size).toBe(0);
  });

  it('calls a word a leech by lapses or by slip days, whichever the history shows', () => {
    expect(isLeech(makeCard({ fsrs: reviewState({ lapses: 3 }) }), 3)).toBe(true);
    expect(isLeech(makeCard({ fsrs: reviewState({ lapses: 1 }), slipDays: 3 }), 3)).toBe(true);
    expect(isLeech(makeCard({ fsrs: reviewState({ lapses: 1 }), slipDays: 2 }), 3)).toBe(false);
    expect(troubleScore(makeCard({ fsrs: reviewState({ lapses: 1 }), slipDays: 4 }))).toBe(4);
    expect(troubleScore(makeCard())).toBe(0);
  });
});
