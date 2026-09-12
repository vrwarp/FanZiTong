import { useEffect, useState } from 'react';
import { buildStarterDeck } from '@/data/starterDeck';
import { META_KEYS, repository, type Repository } from '@/db/repository';
import { CURRENT_RULE, repairSchedules } from '@/lib/fsrs/repair';

export type BootstrapState =
  { status: 'loading' } | { status: 'ready'; seeded: boolean } | { status: 'error'; error: string };

/** What the one-time schedule repair did, kept in meta so the dashboard can say so once. */
export interface ScheduleRepairSummary {
  at: string;
  /** Which rules the histories were replayed under (see lib/fsrs/repair). */
  rule: number;
  /** Cards whose schedule changed. */
  repaired: number;
  /** Cards that only gained a record of their last Again. */
  annotated: number;
  /** Studied cards whose history did not reproduce their state, left as they were. */
  unverifiable: number;
  /** The first few repaired words, for the notice. */
  words: string[];
}

/**
 * First-launch initialization: seed the starter deck into an empty database
 * (PRD Journey 1 assumes a populated deck) and ask the browser for persistent
 * storage so the offline data is not evicted. Existing data is then brought
 * under the current scheduling rules, once.
 */
export async function bootstrapDatabase(repo: Repository = repository): Promise<boolean> {
  const seededAt = await repo.getMeta(META_KEYS.seededAt);
  const count = await repo.countCards();
  let seeded = false;
  if (!seededAt && count === 0) {
    await repo.importCards(await buildStarterDeck());
    seeded = true;
  }
  if (!seededAt) await repo.setMeta(META_KEYS.seededAt, new Date().toISOString());
  await repairSchedulesOnce(repo);
  return seeded;
}

/**
 * Recompute every studied card's schedule under the rules in force, the first
 * time this build runs on a device. Each rule the app has adopted changed what
 * a history means — the once-a-day rule, then a word in Review being moved
 * only by reading and the scheduler counting days from 4 a.m. — and the
 * history is all there, so it is replayed (see lib/fsrs/repair). Runs once per
 * rule version: the summary in meta is the marker.
 */
export async function repairSchedulesOnce(
  repo: Repository,
  now: Date = new Date(),
): Promise<ScheduleRepairSummary | null> {
  if (await repo.getMeta(META_KEYS.scheduleRepair)) return null;
  const [cards, logs, settings] = await Promise.all([
    repo.getAllCards(),
    repo.getAllReviewLogs(),
    repo.getSettings(),
  ]);
  const result = repairSchedules(cards, logs, settings);
  const writes = [...result.repaired.map((r) => r.card), ...result.annotated];
  if (writes.length > 0) await repo.putCards(writes);
  const summary: ScheduleRepairSummary = {
    at: now.toISOString(),
    rule: CURRENT_RULE.version,
    repaired: result.repaired.length,
    annotated: result.annotated.length,
    unverifiable: result.unverifiable,
    words: result.repaired.slice(0, 6).map((r) => r.card.traditional),
  };
  await repo.setMeta(META_KEYS.scheduleRepair, JSON.stringify(summary));
  return summary;
}

/** The stored repair summary, or null when it never ran or cannot be read. */
export function parseRepairSummary(raw: string | undefined): ScheduleRepairSummary | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ScheduleRepairSummary>;
    if (typeof parsed.at !== 'string' || typeof parsed.repaired !== 'number') return null;
    return {
      at: parsed.at,
      rule: typeof parsed.rule === 'number' ? parsed.rule : 1,
      repaired: parsed.repaired,
      annotated: parsed.annotated ?? 0,
      unverifiable: parsed.unverifiable ?? 0,
      words: Array.isArray(parsed.words) ? parsed.words.filter((w) => typeof w === 'string') : [],
    };
  } catch {
    return null;
  }
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
