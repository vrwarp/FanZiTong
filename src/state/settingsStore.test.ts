import { createDatabase } from '@/db/database';
import { createRepository } from '@/db/repository';
import { DEFAULT_SETTINGS } from '@/types';
import { createSettingsStore } from './settingsStore';

describe('settingsStore', () => {
  it('applies patches synchronously, persists them, and tracks the live row', async () => {
    const repo = createRepository(createDatabase('settings-store-1'));
    await repo.saveSettings({ maxDailyNewCards: 7 });
    const store = createSettingsStore(repo);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.isLoaded()).toBe(false);
    expect(store.getSnapshot()).toEqual(DEFAULT_SETTINGS);

    await vi.waitFor(() => expect(store.isLoaded()).toBe(true));
    expect(store.getSnapshot().maxDailyNewCards).toBe(7);

    const pending = store.update({ theme: 'dark' });
    expect(store.getSnapshot().theme).toBe('dark'); // optimistic, before the write resolves
    expect(listener).toHaveBeenCalled();
    await pending;
    expect((await repo.getSettings()).theme).toBe('dark');

    // A write from elsewhere (e.g. a backup restore) flows back through the live query.
    await repo.saveSettings({ leechThreshold: 5 });
    await vi.waitFor(() => expect(store.getSnapshot().leechThreshold).toBe(5));
    expect(store.getSnapshot().theme).toBe('dark');

    store.dispose();
    await repo.db.delete();
  });

  it('serializes rapid successive writes so none is lost', async () => {
    const repo = createRepository(createDatabase('settings-store-2'));
    const store = createSettingsStore(repo);
    store.subscribe(() => undefined);
    await vi.waitFor(() => expect(store.isLoaded()).toBe(true));
    const writes = [
      store.update({ maxDailyNewCards: 4 }),
      store.update({ pinyinRevealDelayMs: 3000 }),
      store.update({ theme: 'dark' }),
    ];
    await Promise.all(writes);
    const saved = await repo.getSettings();
    expect(saved).toMatchObject({ maxDailyNewCards: 4, pinyinRevealDelayMs: 3000, theme: 'dark' });
    store.dispose();
    await repo.db.delete();
  });
});
