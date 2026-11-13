import { makeCard, makeLog, reviewState } from '@/test/factories';
import { CardState } from '@/types';
import {
  countHardDays,
  countSlipDays,
  isHardLoop,
  isLeech,
  restartsOf,
  TROUBLE_WINDOW_DAYS,
  troubleLabel,
  troubleScore,
  troubleWindowStart,
} from './slips';

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

  it('counts the days a word was rated Hard, from its restart if it had one', () => {
    const card = makeCard();
    const hard = (stateBefore: number, reviewTimestamp: string) =>
      makeLog({ cardId: card.id, rating: 2, stateBefore, reviewTimestamp });
    const logs = [
      hard(CardState.New, '2026-09-09T15:00:00.000Z'), // first sight: not a hard day
      hard(CardState.Learning, '2026-09-10T15:00:00.000Z'),
      hard(CardState.Learning, '2026-09-10T22:00:00.000Z'), // same evening: one day
      hard(CardState.Review, '2026-09-12T15:00:00.000Z'),
      makeLog({
        cardId: card.id,
        rating: 1,
        stateBefore: CardState.Review,
        reviewTimestamp: '2026-09-13T15:00:00.000Z',
      }),
    ];
    expect(countHardDays(logs).get(card.id)).toBe(2);
    expect(countSlipDays(logs).get(card.id)).toBe(1);
    const restarts = restartsOf([{ id: card.id, restartedAt: '2026-09-12T00:00:00.000Z' }]);
    expect(countHardDays(logs, undefined, restarts).get(card.id)).toBe(1);
    expect(restartsOf([{ id: card.id }]).size).toBe(0);
  });

  it('calls a Hard loop at the ceiling a leech, and names what put a word on the list', () => {
    const loop = makeCard({ fsrs: reviewState({ difficulty: 9.9, lapses: 1 }), hardDays: 5 });
    expect(isHardLoop(loop, 3)).toBe(true);
    expect(isLeech(loop, 3)).toBe(true);
    expect(troubleScore(loop)).toBe(5);
    expect(troubleLabel(loop)).toBe('Hard on 5 days');
    // Hard days below the ceiling are the scheduler's business, not a loop.
    const midway = makeCard({ fsrs: reviewState({ difficulty: 7, lapses: 1 }), hardDays: 5 });
    expect(isHardLoop(midway, 3)).toBe(false);
    expect(isLeech(midway, 3)).toBe(false);
    expect(troubleScore(midway)).toBe(0);
    expect(troubleLabel(midway)).toBe('slipped 0 days');
    expect(troubleLabel(makeCard({ fsrs: reviewState({ lapses: 1 }), slipDays: 4 }))).toBe(
      'slipped 4 days',
    );
    expect(troubleLabel(makeCard({ fsrs: reviewState({ lapses: 3 }), slipDays: 1 }))).toBe(
      'slipped 1 day',
    );
    expect(troubleLabel(makeCard({ fsrs: reviewState({ difficulty: 9.5 }), hardDays: 1 }))).toBe(
      'Hard on 1 day',
    );
  });

  it('counts only what falls inside the window it is given', () => {
    const card = makeCard();
    const again = (reviewTimestamp: string) =>
      makeLog({ cardId: card.id, rating: 1, stateBefore: CardState.Review, reviewTimestamp });
    const logs = [
      again('2026-09-10T15:00:00.000Z'),
      again('2026-09-12T15:00:00.000Z'),
      again('2026-10-20T15:00:00.000Z'),
    ];
    const now = new Date('2026-11-01T15:00:00.000Z');
    expect(troubleWindowStart(now)).toBe('2026-10-02T15:00:00.000Z');
    expect(TROUBLE_WINDOW_DAYS).toBe(30);
    expect(countSlipDays(logs).get(card.id)).toBe(3);
    expect(countSlipDays(logs, undefined, undefined, troubleWindowStart(now)).get(card.id)).toBe(1);
    expect(
      countHardDays(logs, undefined, undefined, troubleWindowStart(now)).get(card.id),
    ).toBeUndefined();
  });

  it('calls a word a leech by its slip days, not by its lifetime lapses', () => {
    // Three lapses long ago and nothing since: the count that only rises is not consulted.
    expect(isLeech(makeCard({ fsrs: reviewState({ lapses: 3 }) }), 3)).toBe(false);
    expect(isLeech(makeCard({ fsrs: reviewState({ lapses: 1 }), slipDays: 3 }), 3)).toBe(true);
    expect(isLeech(makeCard({ fsrs: reviewState({ lapses: 1 }), slipDays: 2 }), 3)).toBe(false);
    expect(troubleScore(makeCard({ fsrs: reviewState({ lapses: 1 }), slipDays: 4 }))).toBe(4);
    expect(troubleScore(makeCard())).toBe(0);
  });
});
