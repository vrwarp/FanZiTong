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

/** A pinned word not missed for this long has recovered, whatever its difficulty says. */
export const RECOVERED_AFTER_DAYS = 14;

/**
 * Pinned, and not forgotten lately: the difficulty is a record of an old
 * struggle, and starting over is the cure — unlike for a pinned word still
 * being missed, where it would only reset a real problem. One export had 54
 * pinned words, 35 of them not missed in a fortnight, and Start over offered
 * one word and one confirmation at a time: it had never been used.
 */
export function isRecoveredPin(
  card: Pick<VocabCard, 'fsrs' | 'lastAgainAt'>,
  now: Date = new Date(),
): boolean {
  if (!isPinned(card)) return false;
  if (!card.lastAgainAt) return true;
  return now.getTime() - new Date(card.lastAgainAt).getTime() >= RECOVERED_AFTER_DAYS * 86_400_000;
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
