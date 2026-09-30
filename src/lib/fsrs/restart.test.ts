import { makeCard, reviewState } from '@/test/factories';
import { CardState } from '@/types';
import { isPinned, restartCard } from './restart';

describe('a word started over', () => {
  it('goes back to new with its verdicts and counts cleared, and keeps its introduction', () => {
    const card = makeCard({
      fsrs: reviewState({ difficulty: 9.94, stability: 3.2, reps: 25 }),
      lastAgainAt: '2026-09-22T16:42:00.000Z',
      lastHardAt: '2026-09-24T16:17:00.000Z',
      lastPassAt: '2026-09-25T06:56:00.000Z',
      slipDays: 4,
      hardDays: 6,
      introducedAt: '2026-09-21T16:10:00.000Z',
      byEar: { at: '2026-09-24T04:54:00.000Z', known: true },
    });
    const now = new Date('2026-10-01T05:00:00.000Z');
    const next = restartCard(card, now);
    expect(next.fsrs.state).toBe(CardState.New);
    expect(next.fsrs.reps).toBe(0);
    expect(next.fsrs.due).toBe(now.toISOString());
    expect(next.restartedAt).toBe(now.toISOString());
    expect(next.updatedAt).toBe(now.toISOString());
    expect(next.slipDays).toBe(0);
    expect(next.hardDays).toBe(0);
    expect(next.lastAgainAt).toBeUndefined();
    expect(next.lastHardAt).toBeUndefined();
    expect(next.lastPassAt).toBeUndefined();
    // Met twenty-five times: not met face up again, and still known by ear.
    expect(next.introducedAt).toBe(card.introducedAt);
    expect(next.byEar).toEqual(card.byEar);
    expect(next.id).toBe(card.id);
    expect(next.createdAt).toBe(card.createdAt);
  });

  it('is offered to a studied word at a difficulty no rating can lower', () => {
    expect(isPinned(makeCard({ fsrs: reviewState({ difficulty: 9.5, reps: 9 }) }))).toBe(true);
    expect(isPinned(makeCard({ fsrs: reviewState({ difficulty: 9.4, reps: 9 }) }))).toBe(false);
    expect(isPinned(makeCard())).toBe(false);
  });
});
