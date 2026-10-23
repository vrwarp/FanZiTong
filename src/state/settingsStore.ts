import { liveQuery, type Subscription } from 'dexie';
import { repository, type Repository } from '@/db/repository';
import { DEFAULT_SETTINGS, type UserSettings } from '@/types';

/**
 * Process-wide settings store.
 *
 * The database is the source of truth (a Dexie live query pushes every
 * change here), but `updateSettings` applies the patch to the in-memory
 * snapshot synchronously so controls respond instantly, before the
 * IndexedDB write and live-query round trip complete.
 */
export function createSettingsStore(repo: Repository = repository) {
  let current: UserSettings = DEFAULT_SETTINGS;
  let loaded = false;
  let subscription: Subscription | null = null;
  const listeners = new Set<() => void>();
  // Writes are serialized and persist only the patch, which the repository
  // merges into the stored row. Persisting the in-memory snapshot instead
  // would write the defaults over the stored row when a change lands before
  // the live query has loaded it, or write back a stale value for a field the
  // patch never touched.
  let writeQueue: Promise<unknown> = Promise.resolve();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const ensureSubscribed = () => {
    if (subscription) return;
    subscription = liveQuery(() => repo.getSettings()).subscribe({
      next: (settings) => {
        current = settings;
        loaded = true;
        emit();
      },
      error: (err: unknown) => console.error('settings live query failed', err),
    });
  };

  return {
    subscribe(listener: () => void): () => void {
      ensureSubscribed();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot(): UserSettings {
      return current;
    },
    isLoaded(): boolean {
      return loaded;
    },
    async update(patch: Partial<UserSettings>): Promise<UserSettings> {
      current = { ...current, ...patch };
      emit();
      const write = writeQueue.then(() => repo.saveSettings(patch));
      writeQueue = write.catch(() => undefined);
      return write;
    },
    /** Tear down the live query (tests). */
    dispose() {
      subscription?.unsubscribe();
      subscription = null;
      listeners.clear();
      current = DEFAULT_SETTINGS;
      loaded = false;
    },
  };
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;
export const settingsStore = createSettingsStore();
