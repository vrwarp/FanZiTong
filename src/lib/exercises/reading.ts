import type { ExampleSentence, VocabCard } from '@/types';
import { hasReading } from '@/lib/queue/session';
import { syllablesPerCharacter } from '@/lib/util/pinyin';
import { displayReading } from '@/lib/util/sentenceReadings';
import { ownSentences } from './cloze';
import { readingOf } from './meaning';

/**
 * Mode 6: Say It. The cue is the characters alone, as in recognition, but
 * the answer is typed rather than self-rated: the reading has to be
 * produced, syllable by syllable, before anything is shown. Tones are not
 * asked for — typing tone marks on a phone is the obstacle, not the
 * knowledge — and ü may be written u or v, as an IME takes it.
 *
 * This is the one drill that is a reading. A first-try hit counts like a
 * recognition pass: it can move a word in Review, and after it the day's
 * verdict is in. A wrong try is shown syllable by syllable without the
 * answer and given one more go; right on the second try is recorded and
 * changes nothing; wrong twice, or giving up, is a miss.
 *
 * A word said the Taiwanese way (蚵仔煎 ô-á-tsian) may be typed that way, in
 * Tâi-lô or in POJ spelling, as well as in pinyin.
 */
export interface TypedReadingExercise {
  type: 'typed_reading';
  cardId: string;
  word: string;
  definition: string;
  /** The Mandarin reading one syllable per entry, as the feedback shows it. */
  syllables: string[];
  /** The pinyin readings a typed answer may match, normalized (see `normalizeReading`). */
  accepted: string[];
  /** The as-heard reading, when the card has one that differs from the pinyin. */
  spoken?: string;
  /** The as-heard reading one syllable per entry, for marking a Taiwanese answer. */
  spokenSyllables?: string[];
  /** The as-heard readings a typed answer may match, as Taiwanese keys (see `taiwaneseKey`). */
  acceptedSpoken: string[];
  /** The reading to show once answered: as heard when the card has one, else pinyin. */
  reading: string;
  /** The Mandarin reading, shown beside `reading` when that is the as-heard one. */
  pinyin: string;
  /** A sentence to show once the word is read. */
  sentence?: ExampleSentence;
}

export interface SyllableMark {
  syllable: string;
  ok: boolean;
}

/**
 * A typed reading reduced to what is being asked: letters only, lowercase,
 * no tone marks or numbers, ü as u (and v, the IME spelling of ü, likewise),
 * no spaces, apostrophes or hyphens. "Lǔ ròu fàn", "lu3rou4fan4" and
 * "luroufan" are the same answer.
 */
export function normalizeReading(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/v/g, 'u')
    .replace(/[^a-z]/g, '');
}

/**
 * A Taiwanese reading reduced to one key, whichever way it was spelled.
 * Tâi-lô and POJ differ in a handful of regular ways — ts/ch, tsh/chh, ua/oa,
 * ue/oe, ik/ek, ing/eng, oo/o͘ — and both mark the nasal vowel (nn, ⁿ) and
 * the tones with signs nobody types on a phone. Each spelling is folded onto
 * the other symmetrically, so a reading typed with the syllables run together
 * still meets the card's hyphenated one: "ô-á-tsian", "o a chian", "oa tsian"
 * and "oatsian" all come out "oatsian".
 */
export function taiwaneseKey(input: string): string {
  return input
    .trim()
    .split(/[\s'’-]+/)
    .filter(Boolean)
    .map((token) =>
      normalizeReading(token)
        .replace(/chh/g, 'tsh')
        .replace(/ch/g, 'ts')
        .replace(/ua/g, 'oa')
        .replace(/ue/g, 'oe')
        .replace(/ing/g, 'eng')
        .replace(/ik/g, 'ek')
        .replace(/oo/g, 'o')
        .replace(/nn(?=[^aeiou]|$)/g, ''),
    )
    .join('');
}

/** The as-heard reading cut into syllables: Tâi-lô joins them with hyphens. */
export function spokenSyllablesOf(spoken: string): string[] {
  return spoken
    .trim()
    .split(/[\s-]+/)
    .filter((s) => normalizeReading(s).length > 0);
}

/**
 * Whether a typed answer is one of the readings the exercise accepts: the
 * pinyin however it was typed, or the as-heard reading in Tâi-lô or POJ.
 */
export function readingMatches(
  typed: string,
  accepted: readonly string[],
  acceptedSpoken: readonly string[] = [],
): boolean {
  const value = normalizeReading(typed);
  if (value.length > 0 && accepted.includes(value)) return true;
  const key = taiwaneseKey(typed);
  return key.length > 0 && acceptedSpoken.includes(key);
}

/**
 * Which syllables the typed answer got, so the feedback can point at the
 * second syllable rather than the whole word. Typed one syllable per space,
 * as the prompt asks, syllables are compared one to one; run together, the
 * reading is consumed from the front and a wrong syllable is skipped up to
 * where the next one begins. `normalize` says how a syllable is reduced for
 * the comparison: pinyin by default, the Taiwanese key for an as-heard reading.
 */
export function markSyllables(
  typed: string,
  syllables: readonly string[],
  normalize: (s: string) => string = normalizeReading,
): SyllableMark[] {
  const expected = syllables.map(normalize);
  const tokens = typed
    .trim()
    .split(/[\s'’-]+/)
    .map(normalize)
    .filter(Boolean);
  if (tokens.length === expected.length) {
    return expected.map((s, i) => ({ syllable: syllables[i], ok: tokens[i] === s }));
  }
  let rest = tokens.join('');
  return expected.map((s, i) => {
    if (s && rest.startsWith(s)) {
      rest = rest.slice(s.length);
      return { syllable: syllables[i], ok: true };
    }
    const next = expected[i + 1];
    const cut = next ? rest.indexOf(next) : -1;
    rest = cut >= 0 ? rest.slice(cut) : rest.slice(Math.min(rest.length, s.length));
    return { syllable: syllables[i], ok: false };
  });
}

/** Which reading a wrong try was marked against. */
export type MarkedReading = 'pinyin' | 'spoken';

/**
 * Mark a wrong try against the reading it was closest to: the pinyin, or the
 * as-heard reading when the word has one and the answer matches more of it.
 * A learner who typed "o a chian" for 蚵仔煎 is told which Taiwanese syllable
 * is off, not that every Mandarin one is.
 */
export function markReading(
  typed: string,
  exercise: Pick<TypedReadingExercise, 'syllables' | 'spokenSyllables'>,
): { marks: SyllableMark[]; against: MarkedReading } {
  const pinyin = markSyllables(typed, exercise.syllables);
  if (!exercise.spokenSyllables?.length) return { marks: pinyin, against: 'pinyin' };
  const spoken = markSyllables(typed, exercise.spokenSyllables, taiwaneseKey);
  const hits = (marks: SyllableMark[]) => marks.filter((m) => m.ok).length;
  return hits(spoken) > hits(pinyin)
    ? { marks: spoken, against: 'spoken' }
    : { marks: pinyin, against: 'pinyin' };
}

/** The reading cut into syllables: one per character when they line up, else by the syllable rule. */
export function readingSyllables(card: Pick<VocabCard, 'traditional' | 'pinyin'>): string[] {
  const pinyin = card.pinyin.trim();
  return (
    syllablesPerCharacter(card.traditional, pinyin) ??
    displayReading(pinyin)
      .split(' ')
      .filter((s) => normalizeReading(s).length > 0)
  );
}

/** Build a Say It exercise, or null when the card has no reading to ask for. */
export function buildTypedReadingExercise(
  card: VocabCard,
  opts: { sentence?: ExampleSentence } = {},
): TypedReadingExercise | null {
  if (!hasReading(card)) return null;
  const pinyin = card.pinyin.trim();
  const accepted = [normalizeReading(pinyin)].filter(Boolean);
  const syllables = readingSyllables(card);
  if (accepted.length === 0 || syllables.length === 0) return null;
  const spoken = card.spoken?.trim();
  const spokenKey = spoken ? taiwaneseKey(spoken) : '';
  const acceptedSpoken = spokenKey ? [spokenKey] : [];
  const sentence = opts.sentence ?? ownSentences(card)[0];
  return {
    type: 'typed_reading',
    cardId: card.id,
    word: card.traditional,
    definition: card.definition,
    syllables,
    accepted,
    ...(spoken && spokenKey
      ? { spoken, spokenSyllables: spokenSyllablesOf(spoken), acceptedSpoken }
      : { acceptedSpoken }),
    reading: readingOf(card),
    pinyin,
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
