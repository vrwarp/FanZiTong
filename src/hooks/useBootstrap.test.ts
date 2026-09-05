import { createDatabase } from '@/db/database';
import { createRepository, META_KEYS } from '@/db/repository';
import { STARTER_DECK_SIZE } from '@/data/starterDeck';
import { makeCard } from '@/test/factories';
import { bootstrapDatabase } from './useBootstrap';

describe('bootstrapDatabase', () => {
  it('seeds the starter deck exactly once on an empty database', async () => {
    const repo = createRepository(createDatabase('bootstrap-1'));
    expect(await bootstrapDatabase(repo)).toBe(true);
    expect(await repo.countCards()).toBe(STARTER_DECK_SIZE);
    expect(await repo.getMeta(META_KEYS.seededAt)).toBeTruthy();
    expect(await bootstrapDatabase(repo)).toBe(false);
    expect(await repo.countCards()).toBe(STARTER_DECK_SIZE);
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
