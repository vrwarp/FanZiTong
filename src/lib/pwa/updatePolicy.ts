import { formatInterval } from '@/lib/util/time';

/**
 * Shortest gap between automatic update checks. Foregrounding the app triggers
 * a check, so a learner flicking between apps must not hammer the server.
 */
export const MIN_CHECK_INTERVAL_MS = 5 * 60_000;

/**
 * How long to wait for the new worker to take control after asking it to, before
 * reloading regardless. Long enough for an ordinary activation, short enough
 * that a tap on "Reload" always visibly does something.
 */
export const APPLY_RELOAD_FALLBACK_MS = 2_000;

/** Backstop poll for the rare session that stays open for hours. */
export const BACKSTOP_CHECK_INTERVAL_MS = 60 * 60_000;

export type UpdateStatus =
  /** No check has completed yet this session. */
  | 'unknown'
  /** A check is in flight. */
  | 'checking'
  /** The last check found nothing newer. */
  | 'up-to-date'
  /** A new version is downloaded and waiting for a reload. */
  | 'update-ready'
  /** No service worker here (dev server, private mode, insecure context). */
  | 'unsupported'
  /** The last check could not reach the server. */
  | 'error';

/**
 * Whether an automatic trigger (foreground, reconnect, backstop timer) should
 * actually hit the network, given when the last check finished.
 */
export function shouldAutoCheck(
  lastCheckedAt: number | null,
  now: number,
  minIntervalMs: number = MIN_CHECK_INTERVAL_MS,
): boolean {
  if (lastCheckedAt === null) return true;
  return now - lastCheckedAt >= minIntervalMs;
}

/** "checked 5m ago" — plain enough to tell a learner whether the answer is fresh. */
export function describeLastChecked(lastCheckedAt: number | null, now: number): string {
  if (lastCheckedAt === null) return 'not checked yet';
  if (now - lastCheckedAt < 60_000) return 'checked just now';
  return `checked ${formatInterval(new Date(lastCheckedAt), new Date(now))} ago`;
}

/**
 * The line that identifies a build to a human: the commit, plus the day it was
 * built so two commits are still distinguishable at a glance.
 */
export function formatBuildStamp(buildId: string, buildTime: string): string {
  const built = new Date(buildTime);
  if (Number.isNaN(built.getTime())) return buildId;
  const day = built.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return `${buildId} · built ${day}`;
}
