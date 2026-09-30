import { useEffect, useState } from 'react';
import { buildStarterDeck } from '@/data/starterDeck';
import { META_KEYS, repository, type Repository } from '@/db/repository';
import { sortEvents, type StudyEvent } from '@/lib/analytics/events';
import { CURRENT_RULE, repairSchedules } from '@/lib/fsrs/repair';
import { countHardDays, countSlipDays, restartsOf } from '@/lib/stats/slips';
import type { VocabCard } from '@/types';

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
 * under the current scheduling rules, once, and the counts the leech list
 * reads are checked against the review log, every time.
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
  await backfillLearnerStateOnce(repo);
  await reconcileStudyCounts(repo);
  return seeded;
}

/**
 * Recompute every studied card's schedule under the rules in force, the first
 * time this build runs on a device. Each rule the app has adopted changed what
 * a history means — the once-a-day rule, then a word in Review being moved
 * only by reading and the scheduler counting days from 4 a.m., then Hard
 * heard once a day — and the history is all there, so it is replayed (see
 * lib/fsrs/repair). Runs once per rule version: the summary under that
 * version's meta key is the marker.
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

/**
 * Bring every studied card's slip days and hard days into line with its
 * review log, on every launch. The engine keeps both counts as it goes; this
 * is the safety net for a card an older build rebuilt from authored content
 * with the counts gone (the starter-deck restore did that to forty-six words
 * on one device, and the leech list went quiet), and it is cheap: the log is
 * read for the dashboard anyway. A word that was started over is counted
 * from its restart.
 */
export async function reconcileStudyCounts(repo: Repository): Promise<number> {
  const [cards, logs] = await Promise.all([repo.getAllCards(), repo.getAllReviewLogs()]);
  const restarts = restartsOf(cards);
  const slips = countSlipDays(logs, undefined, restarts);
  const hards = countHardDays(logs, undefined, restarts);
  const writes = cards
    .filter(
      (c) =>
        (slips.get(c.id) ?? 0) !== (c.slipDays ?? 0) ||
        (hards.get(c.id) ?? 0) !== (c.hardDays ?? 0),
    )
    .map((c) => ({ ...c, slipDays: slips.get(c.id) ?? 0, hardDays: hards.get(c.id) ?? 0 }));
  if (writes.length > 0) await repo.putCards(writes);
  return writes.length;
}

/**
 * Write back, once, what the event log remembers and the cards lost: the
 * face-up introduction (`introducedAt`) and the ear check (`byEar`). Both
 * are written on the card when they happen, but an older build's
 * starter-deck restore rebuilt cards without them, so a word met face up
 * could be met face up again and a word checked by ear asked again. The
 * event log is read whole for this, which is why it runs once.
 */
export async function backfillLearnerStateOnce(repo: Repository): Promise<number> {
  if (await repo.getMeta(META_KEYS.learnerStateBackfill)) return 0;
  const [cards, events] = await Promise.all([repo.getAllCards(), repo.getAllStudyEvents()]);
  const writes = restoreFromEvents(cards, events);
  if (writes.length > 0) await repo.putCards(writes);
  await repo.setMeta(META_KEYS.learnerStateBackfill, new Date().toISOString());
  return writes.length;
}

/** The cards whose introduction or ear check the events remember and the card does not. */
export function restoreFromEvents(cards: VocabCard[], events: StudyEvent[]): VocabCard[] {
  const introducedAt = new Map<string, string>();
  const heard = new Map<string, { at: string; known: boolean }>();
  for (const event of sortEvents(events)) {
    if (!event.cardId) continue;
    if (event.kind === 'intro' && !introducedAt.has(event.cardId)) {
      introducedAt.set(event.cardId, event.at);
    }
    if (event.kind === 'answer' && event.heard !== undefined) {
      heard.set(event.cardId, { at: event.at, known: event.heard });
    }
  }
  const writes: VocabCard[] = [];
  for (const card of cards) {
    const intro = card.introducedAt ? undefined : introducedAt.get(card.id);
    const ear = card.byEar ? undefined : heard.get(card.id);
    if (!intro && !ear) continue;
    writes.push({
      ...card,
      ...(intro ? { introducedAt: intro } : {}),
      ...(ear ? { byEar: ear } : {}),
    });
  }
  return writes;
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
