import { createDatabase } from '@/db/database';
import { createRepository, META_KEYS } from '@/db/repository';
import { buildStarterDeck, planStarterRestore, starterDeckSize } from '@/data/starterDeck';
import { GONG_WAN_TANG_HISTORY, makeCard, studyOldWay } from '@/test/factories';
import { bootstrapDatabase, parseRepairSummary, repairSchedulesOnce } from './useBootstrap';

describe('bootstrapDatabase', () => {
  it('seeds the starter deck exactly once on an empty database', async () => {
    const repo = createRepository(createDatabase('bootstrap-1'));
    expect(await bootstrapDatabase(repo)).toBe(true);
    expect(await repo.countCards()).toBe(await starterDeckSize());
    expect(await repo.getMeta(META_KEYS.seededAt)).toBeTruthy();
    expect(await bootstrapDatabase(repo)).toBe(false);
    expect(await repo.countCards()).toBe(await starterDeckSize());
    await repo.db.delete();
  });

  it('does not seed when the user already has cards', async () => {
    const repo = createRepository(createDatabase('bootstrap-2'));
    await repo.putCard(makeCard());
    expect(await bootstrapDatabase(repo)).toBe(false);
    expect(await repo.countCards()).toBe(1);
    await repo.db.delete();
  });
});

describe('a seeded deck and the restore control', () => {
  // The whole point of the control is to be quiet unless something is actually
  // wrong. A deck that was seeded from the shipped rows and then read back out
  // of IndexedDB must report nothing to do — otherwise every learner who has
  // simply used the app would be told 95 of their cards need repairing.
  it('has nothing to add and nothing to repair after a normal first launch', async () => {
    const repo = createRepository(createDatabase('bootstrap-restore'));
    try {
      await bootstrapDatabase(repo);
      const stored = await repo.getAllCards();
      const plan = planStarterRestore(stored, await buildStarterDeck());
      expect(stored).toHaveLength(await starterDeckSize());
      expect(plan.add).toHaveLength(0);
      expect(plan.repair).toHaveLength(0);
    } finally {
      await repo.db.delete();
    }
  });
});

describe('the one-time schedule repair', () => {
  it('rewrites looped cards once, and records what it did', async () => {
    const repo = createRepository(createDatabase('bootstrap-repair'));
    try {
      const looped = studyOldWay(makeCard({ traditional: '貢丸湯' }), GONG_WAN_TANG_HISTORY);
      await repo.importCards([looped.card, makeCard({ traditional: '蛋餅' })], looped.logs);
      expect(await bootstrapDatabase(repo)).toBe(false);

      const stored = await repo.getCard(looped.card.id);
      expect(stored?.fsrs.difficulty).toBeLessThan(looped.card.fsrs.difficulty);
      // The day-two miss fell on a word still at its three-hour step: not a lapse.
      expect(stored?.fsrs.lapses).toBe(0);
      expect(stored?.lastAgainAt).toBe('2026-09-08T13:58:49.000Z');
      expect(stored?.lastPassAt).toBe('2026-09-08T14:01:16.000Z');
      const summary = parseRepairSummary(await repo.getMeta(META_KEYS.scheduleRepair));
      expect(summary).toMatchObject({ rule: 2, repaired: 1, annotated: 0, words: ['貢丸湯'] });
      expect(await repo.getMeta(META_KEYS.scheduleRepairV1)).toBeUndefined();

      // A second launch finds the marker and touches nothing.
      expect(await repairSchedulesOnce(repo)).toBeNull();
      expect((await repo.getCard(looped.card.id))?.fsrs).toEqual(stored?.fsrs);
    } finally {
      await repo.db.delete();
    }
  });

  it('marks a fresh device as done without writing any card', async () => {
    const repo = createRepository(createDatabase('bootstrap-repair-fresh'));
    try {
      await bootstrapDatabase(repo);
      const summary = parseRepairSummary(await repo.getMeta(META_KEYS.scheduleRepair));
      expect(summary).toMatchObject({ repaired: 0, annotated: 0, unverifiable: 0, words: [] });
    } finally {
      await repo.db.delete();
    }
  });

  it('reads back only a well-formed summary', () => {
    expect(parseRepairSummary(undefined)).toBeNull();
    expect(parseRepairSummary('not json')).toBeNull();
    expect(parseRepairSummary('{"at":"x"}')).toBeNull();
    expect(parseRepairSummary('{"at":"2026-09-09T00:00:00.000Z","repaired":2}')).toEqual({
      at: '2026-09-09T00:00:00.000Z',
      rule: 1,
      repaired: 2,
      annotated: 0,
      unverifiable: 0,
      words: [],
    });
  });
});
