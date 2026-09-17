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
 */
export interface TypedReadingExercise {
  type: 'typed_reading';
  cardId: string;
  word: string;
  definition: string;
  /** The Mandarin reading one syllable per entry, as the feedback shows it. */
  syllables: string[];
  /** The readings a typed answer may match, normalized (see `normalizeReading`). */
  accepted: string[];
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

/** Whether a typed answer is one of the readings the exercise accepts. */
export function readingMatches(typed: string, accepted: readonly string[]): boolean {
  const value = normalizeReading(typed);
  return value.length > 0 && accepted.includes(value);
}

/**
 * Which syllables the typed answer got, so the feedback can point at the
 * second syllable rather than the whole word. Typed one syllable per space,
 * as the prompt asks, syllables are compared one to one; run together, the
 * reading is consumed from the front and a wrong syllable is skipped up to
 * where the next one begins.
 */
export function markSyllables(typed: string, syllables: readonly string[]): SyllableMark[] {
  const expected = syllables.map(normalizeReading);
  const tokens = typed
    .trim()
    .split(/[\s'’-]+/)
    .map(normalizeReading)
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
  const accepted = Array.from(
    new Set([normalizeReading(pinyin), ...(card.spoken ? [normalizeReading(card.spoken)] : [])]),
  ).filter(Boolean);
  const syllables = readingSyllables(card);
  if (accepted.length === 0 || syllables.length === 0) return null;
  const sentence = opts.sentence ?? ownSentences(card)[0];
  return {
    type: 'typed_reading',
    cardId: card.id,
    word: card.traditional,
    definition: card.definition,
    syllables,
    accepted,
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
