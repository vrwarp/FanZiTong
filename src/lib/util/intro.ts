/** First-run coaching flags, kept in localStorage (per device, not part of a backup). */
export const INTRO_DISMISSED_KEY = 'fzt-howitworks-dismissed';
export const REVEAL_COUNT_KEY = 'fzt-reveals';

export function readIntroDismissed(): boolean {
  try {
    return localStorage.getItem(INTRO_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissIntro(): void {
  try {
    localStorage.setItem(INTRO_DISMISSED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Bring back the "How this works" card and the rating rubric. */
export function resetIntro(): void {
  try {
    localStorage.removeItem(INTRO_DISMISSED_KEY);
    localStorage.removeItem(REVEAL_COUNT_KEY);
  } catch {
    /* ignore */
  }
}
