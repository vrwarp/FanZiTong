/**
 * Pinyin helpers.
 *
 * - `numberedToMarks` converts "lu3 rou4 fan4" → "lǔ ròu fàn" (tone numbers → diacritics).
 * - `containsPinyin` is a heuristic detector used by tests to assert that no
 *   Pinyin leaks into an exercise prompt (PRD AC-2).
 */

const TONE_MARKS: Record<string, string[]> = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  ü: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
  A: ['A', 'Ā', 'Á', 'Ǎ', 'À'],
  E: ['E', 'Ē', 'É', 'Ě', 'È'],
  I: ['I', 'Ī', 'Í', 'Ǐ', 'Ì'],
  O: ['O', 'Ō', 'Ó', 'Ǒ', 'Ò'],
  U: ['U', 'Ū', 'Ú', 'Ǔ', 'Ù'],
  Ü: ['Ü', 'Ǖ', 'Ǘ', 'Ǚ', 'Ǜ'],
};

const SYLLABLE_RE = /([a-zA-ZüÜ]+)([1-5])/g;

function applyTone(syllable: string, tone: number): string {
  const s = syllable.replace(/v/g, 'ü').replace(/V/g, 'Ü');
  if (tone === 5 || tone === 0) return s;
  const lower = s.toLowerCase();
  // Standard placement rules: a/e first; "ou" → o; otherwise the last vowel.
  let index = -1;
  if (lower.includes('a')) index = lower.indexOf('a');
  else if (lower.includes('e')) index = lower.indexOf('e');
  else if (lower.includes('ou')) index = lower.indexOf('o');
  else {
    for (let i = lower.length - 1; i >= 0; i -= 1) {
      if ('iouü'.includes(lower[i])) {
        index = i;
        break;
      }
    }
  }
  if (index === -1) return s;
  const vowel = s[index];
  const marks = TONE_MARKS[vowel];
  if (!marks) return s;
  return s.slice(0, index) + marks[tone] + s.slice(index + 1);
}

/** Convert tone-numbered pinyin to tone-marked pinyin. Already-marked text is returned unchanged. */
export function numberedToMarks(input: string): string {
  return input.replace(SYLLABLE_RE, (_m, syllable: string, tone: string) =>
    applyTone(syllable, Number(tone)),
  );
}

const TONE_DIACRITIC_RE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;
const LATIN_RE = /[a-z]/i;

/** Heuristic: text "looks like Pinyin" if it contains a tone diacritic or Latin letters. */
export function containsPinyin(text: string): boolean {
  return TONE_DIACRITIC_RE.test(text) || LATIN_RE.test(text);
}

/** Han characters plus Bopomofo letters, which Taiwanese internet slang uses as words (ㄏㄏ, 頗ㄏ). */
const HAN_RE = /[\p{Script=Han}\p{Script=Bopomofo}]/u;
export function containsHan(text: string): boolean {
  return HAN_RE.test(text);
}

/** Split a string into its Han / Bopomofo characters (code points). */
export function hanChars(text: string): string[] {
  return Array.from(text).filter((c) => HAN_RE.test(c));
}

/**
 * Per-character readings when the pinyin has exactly one syllable per
 * character (e.g. "lǔ ròu fàn" for 滷肉飯); otherwise null.
 */
export function syllablesPerCharacter(word: string, pinyin: string): string[] | null {
  const chars = hanChars(word);
  const syllables = pinyin
    .trim()
    .split(/[\s·]+/)
    .filter(Boolean);
  return syllables.length === chars.length && chars.length > 0 ? syllables : null;
}
