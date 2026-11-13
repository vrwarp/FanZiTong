/**
 * What the reading mode and the common-character check remember, kept as one
 * small JSON document in the meta table: which common characters the learner
 * says they can and cannot read, which characters they tapped as unreadable
 * while reading sentences, and how fast the last runs went.
 */
export interface ReadingRun {
  at: string;
  sentences: number;
  /** Chinese characters read. */
  characters: number;
  /** Characters tapped as not readable. */
  tapped: number;
  /** Time spent reading, before the answers were shown. */
  ms: number;
}

export interface ReadingState {
  /** Common characters the learner marked as readable. */
  known: string[];
  /** Common characters the learner marked as not readable. */
  unknown: string[];
  /** Characters tapped while reading, with how often. */
  taps: Record<string, number>;
  /** The most recent runs, oldest first. */
  runs: ReadingRun[];
  /** Sentences read lately, newest last, so a run does not repeat them. */
  recent: string[];
}

export const READING_STATE_KEY = 'readingStateV1';
export const READING_RUNS_LIMIT = 60;
export const READING_RECENT_LIMIT = 200;

export function emptyReadingState(): ReadingState {
  return { known: [], unknown: [], taps: {}, runs: [], recent: [] };
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/** Read the stored document; anything unreadable is an empty state, never an error. */
export function parseReadingState(raw: string | undefined | null): ReadingState {
  if (!raw) return emptyReadingState();
  try {
    const data = JSON.parse(raw) as Partial<ReadingState> | null;
    if (!data || typeof data !== 'object') return emptyReadingState();
    const taps: Record<string, number> = {};
    if (data.taps && typeof data.taps === 'object') {
      for (const [ch, n] of Object.entries(data.taps)) {
        if (typeof n === 'number' && n > 0) taps[ch] = n;
      }
    }
    const runs = Array.isArray(data.runs)
      ? data.runs.filter(
          (r): r is ReadingRun =>
            Boolean(r) &&
            typeof r.at === 'string' &&
            typeof r.sentences === 'number' &&
            typeof r.characters === 'number' &&
            typeof r.tapped === 'number' &&
            typeof r.ms === 'number',
        )
      : [];
    return {
      known: strings(data.known),
      unknown: strings(data.unknown),
      taps,
      runs,
      recent: strings(data.recent),
    };
  } catch {
    return emptyReadingState();
  }
}

/** Record one sitting of the common-character check: what was shown, and which were tapped as not readable. */
export function recordCharacterCheck(
  state: ReadingState,
  shown: readonly string[],
  notReadable: ReadonlySet<string>,
): ReadingState {
  const known = new Set(state.known);
  const unknown = new Set(state.unknown);
  for (const ch of shown) {
    if (notReadable.has(ch)) {
      unknown.add(ch);
      known.delete(ch);
    } else {
      known.add(ch);
      unknown.delete(ch);
    }
  }
  return { ...state, known: Array.from(known), unknown: Array.from(unknown) };
}

/** A character the learner has now learned to read: off the not-readable list. */
export function markCharacterKnown(state: ReadingState, char: string): ReadingState {
  return {
    ...state,
    known: state.known.includes(char) ? state.known : [...state.known, char],
    unknown: state.unknown.filter((c) => c !== char),
  };
}

/** Record a reading run: its speed, the sentences it used, and every character tapped. */
export function recordReadingRun(
  state: ReadingState,
  run: ReadingRun,
  sentences: readonly string[],
  tapped: readonly string[],
): ReadingState {
  const taps = { ...state.taps };
  for (const ch of tapped) taps[ch] = (taps[ch] ?? 0) + 1;
  return {
    ...state,
    taps,
    runs: [...state.runs, run].slice(-READING_RUNS_LIMIT),
    recent: [...state.recent, ...sentences].slice(-READING_RECENT_LIMIT),
  };
}

/** Characters read per minute over the given runs (null when nothing was timed). */
export function charactersPerMinute(runs: readonly ReadingRun[]): number | null {
  const ms = runs.reduce((sum, r) => sum + r.ms, 0);
  const chars = runs.reduce((sum, r) => sum + r.characters, 0);
  if (ms <= 0 || chars <= 0) return null;
  return Math.round(chars / (ms / 60_000));
}

/** The characters tapped most while reading, most often first. */
export function mostTapped(state: ReadingState, limit = 24): { char: string; taps: number }[] {
  return Object.entries(state.taps)
    .map(([char, taps]) => ({ char, taps }))
    .sort((a, b) => b.taps - a.taps || (a.char < b.char ? -1 : 1))
    .slice(0, limit);
}
