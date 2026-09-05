export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Local-time start of day. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** YYYY-MM-DD in local time. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Human-friendly interval label used on the FSRS rating buttons, e.g.
 * "1m", "6m", "25m", "3h", "1d", "12d", "2mo", "1.5y". Learning steps show
 * exact minutes so Again and Hard never read the same.
 */
export function formatInterval(from: Date, to: Date): string {
  const ms = Math.max(0, to.getTime() - from.getTime());
  const minutes = ms / MINUTE_MS;
  if (minutes < 1) return '<1m';
  // Never print "60m" or "24h": a value that rounds up to the next unit uses that unit.
  if (Math.round(minutes) < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (Math.round(hours) < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.max(1, Math.round(days))}d`;
  const months = days / 30.437;
  if (months < 12) return `${Math.round(months)}mo`;
  const years = days / 365.25;
  return `${years < 10 ? years.toFixed(1).replace(/\.0$/, '') : Math.round(years)}y`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/** Session time for the summary: whole minutes, never a stopwatch reading. */
export function formatSessionTime(ms: number): string {
  const minutes = Math.round(Math.max(0, ms) / 60_000);
  if (minutes < 1) return '< 1 min';
  return `${minutes} min`;
}

export function formatRelativeDue(due: Date, now: Date): string {
  const diff = due.getTime() - now.getTime();
  if (diff <= 0) return 'due now';
  return `in ${formatInterval(now, due)}`;
}
