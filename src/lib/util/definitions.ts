/**
 * Comparing English glosses roughly: the words they are made of, and whether
 * two of them say the same thing. Used to keep a near-synonym out of a
 * Which Word set and a card's own sense out of its dictionary line.
 */
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'of',
  'to',
  'in',
  'on',
  'with',
  'and',
  'or',
  'for',
  'as',
  'by',
  'at',
  'from',
  'is',
  'are',
  'be',
  'it',
  'its',
  'one',
  'very',
  'kind',
  'sort',
  'type',
  'style',
  'taiwanese',
  'taiwan',
  'chinese',
  'slang',
  'coll',
  'sth',
  'sb',
  'lit',
  'fig',
]);

const WORDS_CACHE = new Map<string, Set<string>>();
const WORDS_CACHE_LIMIT = 5000;

/** The words a definition is made of, lowercased and roughly singular; parentheticals dropped. */
export function contentWords(definition: string): Set<string> {
  const cached = WORDS_CACHE.get(definition);
  if (cached) return cached;
  const words = definition
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
  const set = new Set(words);
  if (WORDS_CACHE.size >= WORDS_CACHE_LIMIT) WORDS_CACHE.clear();
  WORDS_CACHE.set(definition, set);
  return set;
}

/**
 * Two definitions close enough that a learner given one could fairly pick
 * the other's word: they share two content words, or the shorter is
 * contained in the longer ("Rice" and "Plain steamed rice").
 */
export function nearSynonyms(a: string, b: string): boolean {
  const x = contentWords(a);
  const y = contentWords(b);
  if (x.size === 0 || y.size === 0) return false;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  if (shared >= 2) return true;
  return shared === Math.min(x.size, y.size);
}

/** The most dictionary senses shown beside a card's own definition. */
export const MAX_OTHER_SENSES = 3;

/**
 * The dictionary senses worth showing next to a card's definition: not the
 * sense the card teaches, not a repeat of one already kept, and never more
 * than three — a reveal is a glance, not a dictionary page.
 */
export function otherSenses(
  definition: string,
  senses: readonly string[] | undefined,
  limit: number = MAX_OTHER_SENSES,
): string[] {
  if (!senses) return [];
  const kept: string[] = [];
  for (const sense of senses) {
    if (kept.length >= limit) break;
    if (nearSynonyms(definition, sense)) continue;
    if (kept.some((k) => nearSynonyms(k, sense))) continue;
    kept.push(sense);
  }
  return kept;
}
