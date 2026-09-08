import { createDatabase } from '@/db/database';
import { createRepository, META_KEYS } from '@/db/repository';
import { buildStarterDeck, planStarterRestore, starterDeckSize } from '@/data/starterDeck';
import { makeCard } from '@/test/factories';
import { bootstrapDatabase } from './useBootstrap';

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
