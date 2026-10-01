import type { VocabCard } from '@/types';
import { newFsrsState } from './scheduler';

/**
 * Difficulty at or above which FSRS has run out of verdicts. A card here is
 * pinned: Good leaves difficulty where it is, Easy takes a hundredth off it,
 * and stability grows in proportion to (11 − D), so the word comes back every
 * few days for good. One export held twenty-three such words, ten of which
 * had never lapsed — they were read, slowly, and rated Hard until the
 * ceiling. No rating brings them down; a fresh first sight does.
 */
export const PINNED_DIFFICULTY = 9.5;

/** Studied, and at a difficulty no rating can lower. */
export function isPinned(card: Pick<VocabCard, 'fsrs'>): boolean {
  return card.fsrs.reps > 0 && card.fsrs.difficulty >= PINNED_DIFFICULTY;
}

/**
 * Start a word over: the schedule goes back to new, so its next look is a
 * first sight that seeds stability and difficulty from what the learner knows
 * of the word now, and everything the day's rules remember about it is
 * cleared. The review log stays — the replay and the leech counts read it
 * from `restartedAt` — and so does the face-up introduction, because a word
 * met twenty times is not met face up again.
 */
export function restartCard(card: VocabCard, now: Date = new Date()): VocabCard {
  const nowIso = now.toISOString();
  const next: VocabCard = {
    ...card,
    fsrs: newFsrsState(now),
    restartedAt: nowIso,
    slipDays: 0,
    hardDays: 0,
    updatedAt: nowIso,
  };
  delete next.lastAgainAt;
  delete next.lastHardAt;
  delete next.lastPassAt;
  return next;
}
