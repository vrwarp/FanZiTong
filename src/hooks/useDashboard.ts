import { useMemo } from 'react';
import { createScheduler } from '@/lib/fsrs/scheduler';
import { buildSessionQueue, type SessionPlan } from '@/lib/queue/session';
import {
  averageRetrievability,
  computeStreak,
  countNewCardsIntroducedToday,
  countReviewsToday,
  findLeeches,
  logsOnDay,
  retentionRate,
} from '@/lib/stats/analytics';
import type { ReviewLog, UserSettings, VocabCard } from '@/types';

export interface DashboardModel {
  plan: SessionPlan;
  streak: number;
  reviewsToday: number;
  newCardsToday: number;
  retentionToday: number | null;
  averageRetrievability: number | null;
  leechCount: number;
  totalCards: number;
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
  return {
    plan,
    streak: computeStreak(logs, now),
    reviewsToday,
    newCardsToday,
    retentionToday: retentionRate(logsOnDay(logs, now)),
    averageRetrievability: averageRetrievability(scheduler, cards, now),
    leechCount: findLeeches(cards, settings.leechThreshold).length,
    totalCards: cards.length,
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
