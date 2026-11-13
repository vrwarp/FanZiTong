import type { StudyEvent } from '@/lib/analytics/events';
import { CardState } from '@/types';
import { DAY_MS, startOfDay } from '@/lib/util/time';

/**
 * Reading speed, week by week.
 *
 * Stats showed how often a word was read and never how fast. One learner's
 * median time to read a word they got right sat between 4.4 and 6.0 seconds
 * for seven weeks, with nothing on any screen to say so — and speed is what
 * separates recognising a word from reading with it.
 */
export interface FluencyWeek {
  /** First day of the week (ISO date of its start). */
  start: string;
  /** Correct first looks at words in Review that week. */
  reads: number;
  /** Median seconds from the prompt to the reveal; null with too few reads. */
  medianSeconds: number | null;
  /** Share read in under three seconds (0–1); null with too few reads. */
  fastShare: number | null;
}

/** Fewer correct reads than this in a week and no figure is shown for it. */
export const FLUENCY_MIN_READS = 10;
/** A read under this is what fluent reading looks like. */
export const FAST_READ_MS = 3000;

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Median reveal time on correctly read words in Review — the first look of a
 * session only, since a second look minutes later is a memory of the screen —
 * for each of the last `weeks` seven-day spans, oldest first.
 */
export function weeklyReadingSpeed(events: StudyEvent[], now: Date, weeks = 8): FluencyWeek[] {
  const end = startOfDay(now).getTime() + DAY_MS;
  const buckets: number[][] = Array.from({ length: weeks }, () => []);
  for (const e of events) {
    if (e.kind !== 'answer' || e.exerciseType !== 'rapid_recognition') continue;
    if (!e.applied || e.revealLatencyMs === undefined || e.rating === undefined) continue;
    if (e.rating < 2 || e.stateBefore !== CardState.Review || (e.repeatIndex ?? 0) > 0) continue;
    const age = end - new Date(e.at).getTime();
    if (age <= 0) continue;
    const index = weeks - 1 - Math.floor(age / (7 * DAY_MS));
    if (index < 0 || index >= weeks) continue;
    buckets[index].push(e.revealLatencyMs);
  }
  return buckets.map((latencies, index) => {
    const start = new Date(end - (weeks - index) * 7 * DAY_MS).toISOString().slice(0, 10);
    if (latencies.length < FLUENCY_MIN_READS) {
      return { start, reads: latencies.length, medianSeconds: null, fastShare: null };
    }
    const sorted = [...latencies].sort((a, b) => a - b);
    return {
      start,
      reads: sorted.length,
      medianSeconds: Math.round(median(sorted) / 100) / 10,
      fastShare: sorted.filter((ms) => ms < FAST_READ_MS).length / sorted.length,
    };
  });
}
