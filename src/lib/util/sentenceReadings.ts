import { hanChars } from './pinyin';

const VOWELS = 'aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const SYLLABLE_RE = new RegExp(`^(?:[zcs]h|[bpmfdtnlgkhjqxzcsrywv])?[${VOWELS}]+(?:ng|n|r)?`, 'i');
/**
 * Letters a reading may be written with, in either case.
 *
 * The uppercase half is not decoration: a sentence reading is written as a
 * sentence, so any word whose first syllable carries a tone mark starts with
 * one of these — Āmà, Èrshí, Ōu. Keeping only the lowercase forms silently
 * dropped that first letter, which cost the syllable and made the whole
 * sentence fail to line up with its characters.
 */
const LETTERS = `a-zA-Z${VOWELS}${VOWELS.toUpperCase()}`;
/** Everything that is not a letter or the syllable-splitting apostrophe. */
const NON_LETTER_RE = new RegExp(`[^${LETTERS}']`, 'g');
/** Leading punctuation (no apostrophe) and trailing punctuation, around a token. */
const TRIM_RE = new RegExp(`^[^${LETTERS}]+|[^${LETTERS}']+$`, 'g');

/** Count the Mandarin syllables in a pinyin token such as "lǔròufàn" (→ 3). */
export function countSyllables(token: string): number {
  // The apostrophe marks a syllable boundary between vowels (zuì'ài, xī'ān):
  // count each side on its own so the vowel run cannot swallow both.
  return token
    .replace(NON_LETTER_RE, '')
    .split("'")
    .reduce((sum, part) => sum + countRun(part), 0);
}

function countRun(letters: string): number {
  let rest = letters;
  let count = 0;
  while (rest.length > 0) {
    const m = SYLLABLE_RE.exec(rest);
    if (!m || m[0].length === 0) {
      // Stray consonant (e.g. "ng" leftover); skip one char and continue.
      rest = rest.slice(1);
      continue;
    }
    count += 1;
    rest = rest.slice(m[0].length);
  }
  return count;
}

/** "Lǎobǎn," → "lǎo bǎn": the house style of every headword, syllable by syllable. */
export function displayReading(token: string): string {
  const letters = token.replace(NON_LETTER_RE, '').toLowerCase();
  const syllables: string[] = [];
  for (const part of letters.split("'")) {
    let rest = part;
    while (rest.length > 0) {
      const m = SYLLABLE_RE.exec(rest);
      if (!m || m[0].length === 0) {
        rest = rest.slice(1);
        continue;
      }
      syllables.push(m[0]);
      rest = rest.slice(m[0].length);
    }
  }
  return syllables.join(' ') || token;
}

export interface WordReading {
  /** Characters of this word as they appear in the sentence. */
  text: string;
  /** Start index (in code points) inside the sentence. */
  start: number;
  reading: string;
}

/**
 * Align a word-segmented sentence pinyin ("Lǎobǎn, lǔròufàn dà wǎn yī wǎn")
 * with the Han characters of the sentence, one word at a time. Returns null
 * when the syllable count does not match the character count, in which case
 * callers fall back to showing the whole reading at once.
 */
export function alignSentenceReadings(sentence: string, pinyin: string): WordReading[] | null {
  const tokens = pinyin
    .split(/\s+/)
    .map((t) => t.replace(TRIM_RE, ''))
    .filter(Boolean);
  const chars = Array.from(sentence);
  const hanCount = hanChars(sentence).length;
  const syllables = tokens.map(countSyllables);
  const total = syllables.reduce((a, b) => a + b, 0);
  if (total === 0 || total !== hanCount) return null;

  const words: WordReading[] = [];
  let charIndex = 0;
  for (let t = 0; t < tokens.length; t += 1) {
    let need = syllables[t];
    // Skip punctuation / non-Han characters before the word.
    while (
      charIndex < chars.length &&
      !/[\p{Script=Han}\p{Script=Bopomofo}]/u.test(chars[charIndex])
    )
      charIndex += 1;
    const start = charIndex;
    let text = '';
    while (need > 0 && charIndex < chars.length) {
      const ch = chars[charIndex];
      charIndex += 1;
      if (!/[\p{Script=Han}\p{Script=Bopomofo}]/u.test(ch)) {
        text += ch;
        continue;
      }
      text += ch;
      need -= 1;
    }
    words.push({ text, start, reading: tokens[t] });
  }
  return words;
}
