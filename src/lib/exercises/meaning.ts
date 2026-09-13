import type { DomainCategory, ExampleSentence, VocabCard } from '@/types';
import { shuffle, type Rng } from '@/lib/util/random';
import { DAY_MS } from '@/lib/util/time';
import { hasMeaningCue } from '@/lib/queue/session';
import { ownSentences, pickClozeDistractors, type ClozeOptionInfo } from './cloze';
import { isVariantOf } from './foil';

export const MEANING_OPTION_COUNT = 4;
export const MEANING_READING_COUNT = 4;
/** A word known by ear is asked by ear again after this long. */
export const BY_EAR_RECHECK_MS = 30 * DAY_MS;
/** A word not known by ear is asked again after this long, not in the same sitting. */
export const BY_EAR_RETRY_MS = DAY_MS;

export type MeaningOptionInfo = ClozeOptionInfo;

/** Which word a wrong reading belongs to, for the explanation. */
export interface MeaningReadingInfo {
  traditional: string;
  definition: string;
}

/**
 * Mode 5: from the meaning to the word. The cue is the definition alone —
 * never the sound, never the shape. Step one, when it is due, asks which
 * reading the word has (is it known by ear?); step two asks which of four
 * written words it is: the target, readable words from its own domain, and
 * one same-sound misspelling, graded exactly as Fill the Blank grades them.
 */
export interface MeaningExercise {
  type: 'meaning_to_form';
  cardId: string;
  definition: string;
  domain: DomainCategory;
  /**
   * Step one's readings with the word's own among them, or empty when the
   * ear check is not due (see `askByEar`).
   */
  readings: string[];
  /** The word's own reading: as heard when the card has one, else pinyin. */
  reading: string;
  readingInfo: Record<string, MeaningReadingInfo>;
  /** Step two's written words, the answer among them. */
  options: string[];
  answer: string;
  /** Pinyin + gloss for the options that are deck words, shown after answering. */
  optionInfo: Record<string, MeaningOptionInfo>;
  /** The one misspelling of the answer: only this pick is a miss on the target. */
  foil?: string;
  /** A sentence to show once the word is found. */
  sentence?: ExampleSentence;
}

/** The reading the learner would hear for this word. */
export function readingOf(card: Pick<VocabCard, 'pinyin' | 'spoken'>): string {
  return (card.spoken ?? card.pinyin).trim();
}

/**
 * Whether the ear check is due: never asked, or known long enough ago to be
 * worth asking again, or not known a day or more ago.
 */
export function askByEar(card: Pick<VocabCard, 'byEar'>, now: Date): boolean {
  const last = card.byEar;
  if (!last) return true;
  const age = now.getTime() - Date.parse(last.at);
  if (!Number.isFinite(age)) return true;
  return age >= (last.known ? BY_EAR_RECHECK_MS : BY_EAR_RETRY_MS);
}

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
 * contained in the longer ("Rice" and "Plain steamed rice"). Such a word is
 * never offered as a distractor.
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

/** Build a Which Word exercise, or null when the deck cannot supply the options. */
export function buildMeaningExercise(
  card: VocabCard,
  pool: VocabCard[],
  rng: Rng = Math.random,
  opts: { avoid?: ReadonlySet<string>; now?: Date; askByEar?: boolean } = {},
): MeaningExercise | null {
  if (!hasMeaningCue(card)) return null;
  const now = opts.now ?? new Date();
  const avoid = opts.avoid ?? new Set<string>();
  // A word that means nearly the same thing is not a fair distractor in either step.
  const candidates = pool.filter(
    (c) => c.id === card.id || !nearSynonyms(card.definition, c.definition),
  );
  // The same readable words and misspelling Fill the Blank would offer, only
  // without a sentence to rule anything out: the meaning has to do that.
  const { words, foil } = pickClozeDistractors(
    card,
    candidates,
    MEANING_OPTION_COUNT - 1,
    rng,
    avoid,
    '',
  );
  if (words.length + (foil ? 1 : 0) < 2) return null;
  const options = shuffle([card.traditional, ...words, ...(foil ? [foil] : [])], rng);
  const optionInfo: Record<string, MeaningOptionInfo> = {};
  for (const option of options) {
    const match = option === card.traditional ? card : pool.find((c) => c.traditional === option);
    if (match) {
      optionInfo[option] = {
        pinyin: match.pinyin,
        definition: match.definition,
        spoken: match.spoken,
      };
    }
  }

  const reading = readingOf(card);
  const readingInfo: Record<string, MeaningReadingInfo> = {};
  let readings: string[] = [];
  if (opts.askByEar ?? askByEar(card, now)) {
    const seen = new Set([reading]);
    const add = (c: VocabCard) => {
      const r = readingOf(c);
      if (!r || seen.has(r) || readings.length >= MEANING_READING_COUNT - 1) return;
      seen.add(r);
      readings.push(r);
      readingInfo[r] = { traditional: c.traditional, definition: c.definition };
    };
    // The readings of the written options first — the same four words heard,
    // then read — and other words of the domain behind them.
    for (const word of words) {
      const c = pool.find((x) => x.traditional === word);
      if (c) add(c);
    }
    const more = candidates.filter(
      (c) =>
        c.id !== card.id &&
        c.domain === card.domain &&
        !avoid.has(c.traditional) &&
        !words.includes(c.traditional) &&
        !isVariantOf(card, c.traditional),
    );
    for (const c of shuffle(more, rng)) add(c);
    readings = readings.length >= 2 ? shuffle([reading, ...readings], rng) : [];
  }

  const sentence = ownSentences(card)[0];
  return {
    type: 'meaning_to_form',
    cardId: card.id,
    definition: card.definition,
    domain: card.domain,
    readings,
    reading,
    readingInfo,
    options,
    answer: card.traditional,
    optionInfo,
    foil: foil ?? undefined,
    ...(sentence
      ? {
          sentence: {
            traditional: sentence.traditional,
            pinyin: sentence.pinyin,
            translation: sentence.translation,
          },
        }
      : {}),
  };
}
