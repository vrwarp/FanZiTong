import { ownSentences } from '@/lib/exercises/cloze';
import { hanChars } from '@/lib/util/pinyin';
import { shuffle, type Rng } from '@/lib/util/random';
import { CardState, type VocabCard } from '@/types';

/**
 * Reading, as opposed to recognising words.
 *
 * Everything else in the app tests one word at a time. One learner's export
 * showed what that leaves out: the example sentence went unread (a rating
 * came a second and a half after the reveal), connected text reached them
 * about eight times a day, and a third of the characters in their own cards'
 * sentences — 的 這 了 他 要 個 都 — had never been the thing tested by
 * anything. This module is the arithmetic behind the reading mode and the
 * common-character check: which characters the learner can be taken to know,
 * which sentences are made mostly of them, and which common characters
 * nobody has asked about.
 */

/** A sentence offered for reading, with the card it was authored on. */
export interface ReadingSentence {
  cardId: string;
  word: string;
  traditional: string;
  pinyin?: string;
  translation?: string;
  /** Share of the sentence's characters the learner is taken to know (0–1). */
  coverage: number;
}

/** A sentence is offered for reading when at least this share of its characters is known. */
export const READING_MIN_COVERAGE = 0.8;

/** Whether the card has been studied (anything but never seen). */
function isStudied(card: VocabCard): boolean {
  return card.fsrs.state !== CardState.New;
}

/**
 * The characters the learner is taken to know: every character of a studied
 * word, and every character they marked as known in the common-character
 * check — less the ones they marked as not known there.
 */
export function knownCharacters(
  cards: readonly VocabCard[],
  markedKnown: Iterable<string> = [],
  markedUnknown: Iterable<string> = [],
): Set<string> {
  const known = new Set<string>(markedKnown);
  for (const card of cards) {
    if (!isStudied(card)) continue;
    for (const ch of hanChars(card.traditional)) known.add(ch);
  }
  for (const ch of markedUnknown) known.delete(ch);
  return known;
}

/** The share of a text's Chinese characters that are in `known` (1 for a text with none). */
export function coverageOf(text: string, known: ReadonlySet<string>): number {
  const chars = hanChars(text);
  if (chars.length === 0) return 1;
  return chars.filter((ch) => known.has(ch)).length / chars.length;
}

export interface PickSentencesOptions {
  count: number;
  rng?: Rng;
  minCoverage?: number;
  /** Sentences read lately, left for another day. */
  avoid?: ReadonlySet<string>;
}

/**
 * Sentences to read: authored on studied words, made mostly of characters
 * the learner knows, the ones with something still to learn in them first —
 * a sentence already fully known is practice in speed, one at 85% is where a
 * new character is met in company.
 */
export function pickReadingSentences(
  cards: readonly VocabCard[],
  known: ReadonlySet<string>,
  options: PickSentencesOptions,
): ReadingSentence[] {
  const rng = options.rng ?? Math.random;
  const min = options.minCoverage ?? READING_MIN_COVERAGE;
  const seen = new Set<string>();
  const pool: ReadingSentence[] = [];
  for (const card of cards) {
    if (!isStudied(card) || card.setAsideAt) continue;
    for (const s of ownSentences(card)) {
      if (seen.has(s.traditional) || options.avoid?.has(s.traditional)) continue;
      seen.add(s.traditional);
      const coverage = coverageOf(s.traditional, known);
      if (coverage < min) continue;
      pool.push({
        cardId: card.id,
        word: card.traditional,
        traditional: s.traditional,
        pinyin: s.pinyin,
        translation: s.translation,
        coverage,
      });
    }
  }
  const partial = shuffle(
    pool.filter((s) => s.coverage < 1),
    rng,
  );
  const full = shuffle(
    pool.filter((s) => s.coverage >= 1),
    rng,
  );
  // Two in three with something new in them, while there are any.
  const out: ReadingSentence[] = [];
  while (out.length < options.count && (partial.length > 0 || full.length > 0)) {
    const wantFull = out.length % 3 === 2;
    const next = wantFull ? (full.shift() ?? partial.shift()) : (partial.shift() ?? full.shift());
    if (next) out.push(next);
  }
  return out;
}

/** A character of the deck's sentences nobody has tested, and how often it appears. */
export interface UntestedCharacter {
  char: string;
  count: number;
}

/**
 * The characters that appear in the deck's sentences but in no studied word,
 * most frequent first: the glue of written Chinese, which a deck of nouns
 * never asks about. Characters already answered in the check are left out.
 */
export function untestedCharacters(
  cards: readonly VocabCard[],
  answered: ReadonlySet<string> = new Set(),
): UntestedCharacter[] {
  const inStudiedWord = knownCharacters(cards);
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const card of cards) {
    for (const s of ownSentences(card)) {
      if (seen.has(s.traditional)) continue;
      seen.add(s.traditional);
      for (const ch of hanChars(s.traditional)) {
        if (inStudiedWord.has(ch) || answered.has(ch)) continue;
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts, ([char, count]) => ({ char, count })).sort(
    (a, b) => b.count - a.count || (a.char < b.char ? -1 : 1),
  );
}

/**
 * How much of the studied cards' own sentences the learner can be taken to
 * read, character by character (0–1; null with no sentences).
 */
export function sentenceCoverage(
  cards: readonly VocabCard[],
  known: ReadonlySet<string>,
): number | null {
  let total = 0;
  let hit = 0;
  for (const card of cards) {
    if (!isStudied(card)) continue;
    for (const s of ownSentences(card)) {
      for (const ch of hanChars(s.traditional)) {
        total += 1;
        if (known.has(ch)) hit += 1;
      }
    }
  }
  return total === 0 ? null : hit / total;
}

/** What a pasted text holds, measured against the deck. */
export interface TextScan {
  /** Deck words found in the text that the learner has not met yet, in order of appearance. */
  unseen: VocabCard[];
  /** Deck words found that are already being studied. */
  studied: VocabCard[];
  /** Characters of the text that no deck word found in it covers, most frequent first. */
  uncovered: UntestedCharacter[];
  /** Chinese characters in the text. */
  characters: number;
}

/**
 * Find the deck's words in a text the learner pasted — a family message, a
 * bulletin, a menu — taking the longest word at each position, so 貢丸湯 is
 * found as itself and not as 貢丸.
 */
export function scanText(text: string, cards: readonly VocabCard[]): TextScan {
  const byWord = new Map<string, VocabCard>();
  let longest = 1;
  for (const card of cards) {
    const word = card.traditional.trim();
    if (!word || byWord.has(word)) continue;
    byWord.set(word, card);
    longest = Math.max(longest, Array.from(word).length);
    for (const variant of card.variants ?? []) {
      const v = variant.trim();
      if (v && !byWord.has(v)) {
        byWord.set(v, card);
        longest = Math.max(longest, Array.from(v).length);
      }
    }
  }
  const chars = Array.from(text);
  const found = new Map<string, VocabCard>();
  const uncovered = new Map<string, number>();
  let i = 0;
  while (i < chars.length) {
    let matched = 0;
    for (let len = Math.min(longest, chars.length - i); len >= 1; len -= 1) {
      const card = byWord.get(chars.slice(i, i + len).join(''));
      if (card) {
        if (!found.has(card.id)) found.set(card.id, card);
        matched = len;
        break;
      }
    }
    if (matched > 0) {
      i += matched;
      continue;
    }
    const ch = chars[i];
    if (hanChars(ch).length > 0) uncovered.set(ch, (uncovered.get(ch) ?? 0) + 1);
    i += 1;
  }
  const all = Array.from(found.values());
  return {
    unseen: all.filter((c) => !isStudied(c)),
    studied: all.filter(isStudied),
    uncovered: Array.from(uncovered, ([char, count]) => ({ char, count })).sort(
      (a, b) => b.count - a.count || (a.char < b.char ? -1 : 1),
    ),
    characters: hanChars(text).length,
  };
}
