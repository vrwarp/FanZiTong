import type { SessionProgress } from '@/lib/session/engine';
import { dayKey } from '@/lib/util/time';

const KEY = 'fzt-paused-session';

export interface PausedSession {
  /** Local day the session belongs to; a paused session does not survive the night. */
  day: string;
  /** Remaining card ids, current card first. */
  queue: string[];
  /** Answers, time and drill bookkeeping so far, so a resumed session carries on counting. */
  progress?: SessionProgress;
  savedAt: string;
}

export function readPausedSession(now: Date = new Date()): PausedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PausedSession;
    if (parsed.day !== dayKey(now) || !Array.isArray(parsed.queue) || parsed.queue.length === 0) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePausedSession(
  queue: string[],
  progress?: SessionProgress,
  now: Date = new Date(),
): void {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(KEY);
      return;
    }
    const value: PausedSession = {
      day: dayKey(now),
      queue,
      progress,
      savedAt: now.toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function clearPausedSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
