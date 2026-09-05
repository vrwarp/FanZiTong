import { useMemo } from 'react';
import { createScheduler } from '@/lib/fsrs/scheduler';
import { buildSessionQueue, type SessionPlan } from '@/lib/queue/session';
import {
  averageRetrievability,
  computeStreak,
  countAnswersToday,
  countDueByTomorrow,
  countNewCardsIntroducedToday,
  countReviewsToday,
  findLeeches,
  hasEnoughRecallData,
  logsOnDay,
  retentionRate,
} from '@/lib/stats/analytics';
import type { ReviewLog, UserSettings, VocabCard } from '@/types';

export interface DashboardModel {
  plan: SessionPlan;
  streak: number;
  /** Answers to cards already in review (counts against maxDailyReviews). */
  reviewsToday: number;
  /** New cards first seen today (counts against maxDailyNewCards). */
  newCardsToday: number;
  /** Every answer today, including repeats and drills. */
  answersToday: number;
  retentionToday: number | null;
  /** Null until there is enough history for the number to mean something. */
  averageRetrievability: number | null;
  recallDataReady: boolean;
  dueTomorrow: number;
  leechCount: number;
  totalCards: number;
  /** True when today's plan has been cleared. */
  doneForToday: boolean;
}

export function computeDashboard(
  cards: VocabCard[],
  logs: ReviewLog[],
  settings: UserSettings,
  now: Date,
): DashboardModel {
  const reviewsToday = countReviewsToday(logs, now);
  const newCardsToday = countNewCardsIntroducedToday(logs, now);
  const plan = buildSessionQueue({
    cards,
    settings,
    now,
    reviewsDoneToday: reviewsToday,
    newCardsIntroducedToday: newCardsToday,
  });
  const scheduler = createScheduler(settings, { enableFuzz: false });
  const answersToday = countAnswersToday(logs, now);
  const recallDataReady = hasEnoughRecallData(logs);
  return {
    plan,
    streak: computeStreak(logs, now),
    reviewsToday,
    newCardsToday,
    answersToday,
    retentionToday: retentionRate(logsOnDay(logs, now)),
    averageRetrievability: recallDataReady ? averageRetrievability(scheduler, cards, now) : null,
    recallDataReady,
    dueTomorrow: countDueByTomorrow(cards, now),
    leechCount: findLeeches(cards, settings.leechThreshold).length,
    totalCards: cards.length,
    doneForToday: plan.queue.length === 0 && answersToday > 0,
  };
}

export function useDashboard(
  cards: VocabCard[],
  logs: ReviewLog[],
  settings: UserSettings,
  now: Date,
): DashboardModel {
  return useMemo(() => computeDashboard(cards, logs, settings, now), [cards, logs, settings, now]);
}
