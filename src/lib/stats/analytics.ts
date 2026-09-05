import type { FSRS } from 'ts-fsrs';
import {
  CardState,
  DOMAIN_CATEGORIES,
  type DomainCategory,
  type ReviewLog,
  type VocabCard,
} from '@/types';
import { retrievability } from '@/lib/fsrs/scheduler';
import { addDays, dayKey, startOfDay } from '@/lib/util/time';

/** Stability (days) above which a card counts as "mastered" for domain mastery. */
export const MASTERY_STABILITY_DAYS = 30;

export function logsOnDay(logs: ReviewLog[], day: Date): ReviewLog[] {
  const key = dayKey(day);
  return logs.filter((l) => dayKey(new Date(l.reviewTimestamp)) === key);
}

/** Every answer given today, including learning-step repeats and drills. */
export function countAnswersToday(logs: ReviewLog[], now: Date): number {
  return logsOnDay(logs, now).length;
}

/**
 * Reviews answered today: answers to cards that were already in Review or
 * Relearning when answered. New cards and their learning-step repeats are
 * counted separately (`countNewCardsIntroducedToday`). Logs written before
 * `stateBefore` existed count as reviews.
 */
export function countReviewsToday(logs: ReviewLog[], now: Date): number {
  return logsOnDay(logs, now).filter(
    (l) =>
      l.stateBefore === undefined ||
      l.stateBefore === CardState.Review ||
      l.stateBefore === CardState.Relearning,
  ).length;
}

/** Cards that will become due within the next `hours` hours (not due yet now). */
export function countDueWithin(cards: VocabCard[], now: Date, hours: number): number {
  const start = now.getTime();
  const end = start + hours * 3_600_000;
  return cards.filter((c) => {
    if (c.fsrs.state === CardState.New) return false;
    const due = new Date(c.fsrs.due).getTime();
    return due > start && due <= end;
  }).length;
}

/**
 * Reviews that fall due between now and the end of local tomorrow — the
 * "tomorrow" number every screen quotes (a calendar day, not a 24-hour window).
 */
export function countDueByTomorrow(cards: VocabCard[], now: Date): number {
  const start = now.getTime();
  const end = startOfDay(addDays(now, 2)).getTime();
  return cards.filter((c) => {
    if (c.fsrs.state === CardState.New) return false;
    const due = new Date(c.fsrs.due).getTime();
    return due > start && due < end;
  }).length;
}

export const RECALL_MIN_STUDY_DAYS = 7;

/** Number of distinct local days with at least one answer. */
export function countStudyDays(logs: ReviewLog[]): number {
  return new Set(logs.map((l) => dayKey(new Date(l.reviewTimestamp)))).size;
}

/**
 * Retrievability is only meaningful once cards have had time to be forgotten;
 * before a week of study days every percentage reads as a verdict on noise.
 */
export function hasEnoughRecallData(logs: ReviewLog[], minDays = RECALL_MIN_STUDY_DAYS): boolean {
  return countStudyDays(logs) >= minDays;
}

/**
 * Cards whose very first review happened today. This is what the daily
 * "new cards" limit counts against.
 */
export function countNewCardsIntroducedToday(logs: ReviewLog[], now: Date): number {
  const todayKey = dayKey(now);
  const firstReviewByCard = new Map<string, string>();
  for (const log of logs) {
    const existing = firstReviewByCard.get(log.cardId);
    if (!existing || log.reviewTimestamp < existing) {
      firstReviewByCard.set(log.cardId, log.reviewTimestamp);
    }
  }
  let count = 0;
  for (const ts of firstReviewByCard.values()) {
    if (dayKey(new Date(ts)) === todayKey) count += 1;
  }
  return count;
}

/** Proportion of reviews not rated "Again" (null if there were no reviews). */
export function retentionRate(logs: ReviewLog[]): number | null {
  if (logs.length === 0) return null;
  const correct = logs.filter((l) => l.rating !== 1).length;
  return correct / logs.length;
}

export interface DailyPoint {
  /** YYYY-MM-DD (local) */
  day: string;
  total: number;
  correct: number;
  retention: number | null;
}

/** Per-day review totals and retention for the last `days` days (oldest first). */
export function dailySeries(logs: ReviewLog[], days: number, now: Date): DailyPoint[] {
  const buckets = new Map<string, { total: number; correct: number }>();
  const start = startOfDay(addDays(now, -(days - 1)));
  for (let i = 0; i < days; i += 1) {
    buckets.set(dayKey(addDays(start, i)), { total: 0, correct: 0 });
  }
  for (const log of logs) {
    const key = dayKey(new Date(log.reviewTimestamp));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (log.rating !== 1) bucket.correct += 1;
  }
  return Array.from(buckets.entries()).map(([day, b]) => ({
    day,
    total: b.total,
    correct: b.correct,
    retention: b.total === 0 ? null : b.correct / b.total,
  }));
}

/**
 * Consecutive study days ending today (or yesterday, so an unfinished day
 * does not break the streak).
 */
export function computeStreak(logs: ReviewLog[], now: Date): number {
  const days = new Set(logs.map((l) => dayKey(new Date(l.reviewTimestamp))));
  if (days.size === 0) return 0;
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!days.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface DomainMastery {
  domain: DomainCategory;
  total: number;
  mastered: number;
  /** 0-100 */
  percent: number;
}

/** PRD §8: cards with stability > 30d / total cards in the domain. */
export function domainMastery(cards: VocabCard[]): DomainMastery[] {
  return DOMAIN_CATEGORIES.map((domain) => {
    const inDomain = cards.filter((c) => c.domain === domain);
    const mastered = inDomain.filter((c) => c.fsrs.stability > MASTERY_STABILITY_DAYS).length;
    return {
      domain,
      total: inDomain.length,
      mastered,
      percent: inDomain.length === 0 ? 0 : Math.round((mastered / inDomain.length) * 100),
    };
  });
}

/** Cards whose lapse count meets the leech threshold, worst first. */
export function findLeeches(cards: VocabCard[], threshold: number): VocabCard[] {
  return cards
    .filter((c) => c.fsrs.lapses >= threshold)
    .sort((a, b) => b.fsrs.lapses - a.fsrs.lapses || a.traditional.localeCompare(b.traditional));
}

export function totalLapses(cards: VocabCard[]): number {
  return cards.reduce((sum, c) => sum + c.fsrs.lapses, 0);
}

/** Mean current retrievability across reviewed cards (null when none reviewed). */
export function averageRetrievability(
  scheduler: FSRS,
  cards: VocabCard[],
  now: Date,
): number | null {
  const values: number[] = [];
  for (const card of cards) {
    const r = retrievability(scheduler, card.fsrs, now);
    if (r !== null) values.push(r);
  }
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface StateDistribution {
  new: number;
  learning: number;
  review: number;
  relearning: number;
}

export function stateDistribution(cards: VocabCard[]): StateDistribution {
  const dist: StateDistribution = { new: 0, learning: 0, review: 0, relearning: 0 };
  for (const card of cards) {
    switch (card.fsrs.state) {
      case CardState.Learning:
        dist.learning += 1;
        break;
      case CardState.Review:
        dist.review += 1;
        break;
      case CardState.Relearning:
        dist.relearning += 1;
        break;
      default:
        dist.new += 1;
    }
  }
  return dist;
}

export function dueCount(cards: VocabCard[], now: Date): number {
  const nowMs = now.getTime();
  return cards.filter(
    (c) => c.fsrs.state !== CardState.New && new Date(c.fsrs.due).getTime() <= nowMs,
  ).length;
}
