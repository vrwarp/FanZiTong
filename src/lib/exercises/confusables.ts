import type { VocabCard } from '@/types';
import { hanChars, syllablesPerCharacter } from '@/lib/util/pinyin';

/**
 * The two things a distractor can be confused *with*, indexed over a card pool.
 *
 * A drill is only worth answering if its wrong options are mistakes somebody
 * actually makes. There are two such mistakes for a Traditional reader:
 *
 * - **Same sound, wrong characters.** What a Zhuyin/Pinyin IME offers when the
 *   reading is typed: 豆漿 / 豆醬, 便當 / 便檔. This is the production error, and
 *   it is the one heritage speakers make most, because the sound is the part
 *   they already have.
 * - **Same shape, different character.** 滷 / 魯, 己 / 已 / 巳. This is the
 *   reception error, and it is real only where the look-alike is itself
 *   something that gets written — an accepted variant spelling, or a pair the
 *   deck curates a "tell" for.
 *
 * Both indexes are derived from data the deck already carries: readings come
 * from each card's own per-character pinyin, look-alikes from the authored
 * `visualFoils`. Nothing new is shipped to the client, and cards the learner
 * imported are covered on the same terms as the starter deck.
 */

/** Strip tone diacritics and case: "cáo" → "cao". IMEs are typed without tones. */
export function tonelessSyllable(syllable: string): string {
  return syllable.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export interface ConfusableIndex {
  /** Toneless readings recorded for a character across the pool. */
  readingsOf(char: string): string[];
  /** Other characters sharing any reading with this one. */
  homophonesOf(char: string): string[];
  /** Characters authored as look-alikes of this one, in either direction. */
  lookAlikesOf(char: string): string[];
  /** Every spelling the pool treats as real, so a distractor never lands on one. */
  isRealWord(text: string): boolean;
}

function addTo(map: Map<string, Set<string>>, key: string, value: string): void {
  if (key === value) return;
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}

/**
 * A single-character difference between two equal-length words, or null when
 * they differ at zero or several positions. The unit of a foil is one glyph:
 * a swap at two positions at once is not a mistake, it is a different word.
 */
export function singleCharDiff(
  word: string,
  other: string,
): { index: number; from: string; to: string } | null {
  const a = hanChars(word);
  const b = hanChars(other);
  if (a.length !== b.length || a.length === 0) return null;
  let found: { index: number; from: string; to: string } | null = null;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) continue;
    if (found) return null;
    found = { index: i, from: a[i], to: b[i] };
  }
  return found;
}

function build(pool: readonly VocabCard[]): ConfusableIndex {
  const charReadings = new Map<string, Set<string>>();
  const readingChars = new Map<string, Set<string>>();
  const lookAlikes = new Map<string, Set<string>>();
  const real = new Set<string>();

  for (const card of pool) {
    real.add(card.traditional);
    for (const variant of card.variants ?? []) real.add(variant.trim());
  }

  for (const card of pool) {
    const chars = hanChars(card.traditional);
    const syllables = syllablesPerCharacter(card.traditional, card.pinyin);
    if (syllables) {
      chars.forEach((char, i) => {
        const reading = tonelessSyllable(syllables[i]);
        if (!reading) return;
        let readings = charReadings.get(char);
        if (!readings) {
          readings = new Set();
          charReadings.set(char, readings);
        }
        readings.add(reading);
        let chs = readingChars.get(reading);
        if (!chs) {
          chs = new Set();
          readingChars.set(reading, chs);
        }
        chs.add(char);
      });
    }
    // Look-alike pairs are symmetric: if 滷 was authored as confusable with 魯,
    // then 魯 is confusable with 滷 wherever it turns up.
    for (const foil of card.visualFoils ?? []) {
      const expanded = expandToWord(card.traditional, foil);
      if (!expanded) continue;
      const diff = singleCharDiff(card.traditional, expanded);
      if (!diff) continue;
      addTo(lookAlikes, diff.from, diff.to);
      addTo(lookAlikes, diff.to, diff.from);
    }
  }

  return {
    readingsOf: (char) => [...(charReadings.get(char) ?? [])],
    homophonesOf: (char) => {
      const out = new Set<string>();
      for (const reading of charReadings.get(char) ?? []) {
        for (const other of readingChars.get(reading) ?? []) {
          if (other !== char) out.add(other);
        }
      }
      return [...out];
    },
    lookAlikesOf: (char) => [...(lookAlikes.get(char) ?? [])],
    isRealWord: (text) => real.has(text),
  };
}

/**
 * Expand an authored foil into a full-length spelling of the target.
 *
 * Same-length foils are used verbatim; a single-character foil for a
 * multi-character word replaces the first character (滷肉飯 + 鹵 → 鹵肉飯),
 * which is where the authored data puts the confusable glyph.
 */
export function expandToWord(target: string, foil: string): string | null {
  const foilChars = hanChars(foil.trim());
  const targetChars = hanChars(target);
  if (foilChars.length === 0) return null;
  const candidate =
    foilChars.length === 1 && targetChars.length > 1
      ? [foilChars[0], ...targetChars.slice(1)].join('')
      : foilChars.join('');
  return candidate === target ? null : candidate;
}

const cache = new WeakMap<readonly VocabCard[], ConfusableIndex>();

/**
 * The index for a pool, built once per pool array.
 *
 * A session holds one pool for its lifetime, so the identity cache makes this
 * a single pass over the deck per session rather than one per drill.
 */
export function confusableIndex(pool: readonly VocabCard[]): ConfusableIndex {
  const hit = cache.get(pool);
  if (hit) return hit;
  const index = build(pool);
  cache.set(pool, index);
  return index;
}
