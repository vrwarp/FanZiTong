import { useEffect, useState } from 'react';
import { buildStarterDeck } from '@/data/starterDeck';
import { META_KEYS, repository, type Repository } from '@/db/repository';

export type BootstrapState =
  { status: 'loading' } | { status: 'ready'; seeded: boolean } | { status: 'error'; error: string };

/**
 * First-launch initialization: seed the starter deck into an empty database
 * (PRD Journey 1 assumes a populated deck) and ask the browser for persistent
 * storage so the offline data is not evicted.
 */
export async function bootstrapDatabase(repo: Repository = repository): Promise<boolean> {
  const seededAt = await repo.getMeta(META_KEYS.seededAt);
  const count = await repo.countCards();
  let seeded = false;
  if (!seededAt && count === 0) {
    await repo.importCards(buildStarterDeck());
    seeded = true;
  }
  if (!seededAt) await repo.setMeta(META_KEYS.seededAt, new Date().toISOString());
  return seeded;
}

export function useBootstrap(): BootstrapState {
  const [state, setState] = useState<BootstrapState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    bootstrapDatabase()
      .then((seeded) => {
        if (!cancelled) setState({ status: 'ready', seeded });
        if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
          navigator.storage.persist().catch(() => undefined);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', error: (err as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
