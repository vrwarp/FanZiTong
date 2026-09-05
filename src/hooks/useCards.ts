import { useLiveQuery } from 'dexie-react-hooks';
import { repository } from '@/db/repository';
import type { ReviewLog, VocabCard } from '@/types';

const EMPTY_CARDS: VocabCard[] = [];
const EMPTY_LOGS: ReviewLog[] = [];

/** Live list of every card (re-renders on any change). */
export function useCards(): VocabCard[] | undefined {
  return useLiveQuery(() => repository.getAllCards(), []);
}

export function useCardsOrEmpty(): VocabCard[] {
  return useCards() ?? EMPTY_CARDS;
}

export function useCard(id: string | undefined): VocabCard | undefined | null {
  return useLiveQuery(async () => (id ? ((await repository.getCard(id)) ?? null) : null), [id]);
}

/** Live list of all review logs, oldest first. */
export function useReviewLogs(): ReviewLog[] | undefined {
  return useLiveQuery(() => repository.getAllReviewLogs(), []);
}

export function useReviewLogsOrEmpty(): ReviewLog[] {
  return useReviewLogs() ?? EMPTY_LOGS;
}
