import { DEFAULT_SETTINGS } from '@/types';
import { makeCard, makeLog, reviewState } from '@/test/factories';
import { computeDashboard } from './useDashboard';

describe('computeDashboard', () => {
  const now = new Date(2026, 8, 5, 12, 0, 0);
  it('assembles queue, streak and health from cards + logs', () => {
    const due = makeCard({
      id: 'due',
      fsrs: reviewState({ due: '2026-09-01T00:00:00.000Z', lapses: 3 }),
    });
    const fresh = makeCard({ id: 'fresh' });
    const logs = [
      makeLog({
        cardId: 'due',
        reviewTimestamp: new Date(now.getTime() - 3_600_000).toISOString(),
        rating: 1,
      }),
    ];
    const model = computeDashboard([due, fresh], logs, DEFAULT_SETTINGS, now);
    expect(model.plan.queue).toEqual(['due', 'fresh']);
    expect(model.streak).toBe(1);
    expect(model.reviewsToday).toBe(1); // legacy log without stateBefore counts as a review
    expect(model.newCardsToday).toBe(1);
    expect(model.retentionToday).toBe(0);
    expect(model.leechCount).toBe(1);
    expect(model.totalCards).toBe(2);
    expect(model.answersToday).toBe(1);
    // Recall needs a week of study days before it is shown.
    expect(model.recallDataReady).toBe(false);
    expect(model.averageRetrievability).toBeNull();
    expect(model.doneForToday).toBe(false);
  });
});
