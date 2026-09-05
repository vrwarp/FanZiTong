import type { VocabCard } from '@/types';
import { hanChars } from '@/lib/util/pinyin';
import { shuffle, type Rng } from '@/lib/util/random';
import { hasClozeSentence } from '@/lib/queue/session';
import { expandFoil, isVariantOf } from './foil';

export const CLOZE_BLANK_CHAR = '＿';
export const CLOZE_OPTION_COUNT = 4;

export interface ClozeOptionInfo {
  pinyin: string;
  definition: string;
}

export interface ClozeExercise {
  type: 'cloze';
  cardId: string;
  /** Sentence text before / after the blank. */
  before: string;
  after: string;
  options: string[];
  answer: string;
  /** Pinyin + gloss for options that are deck words, shown after answering. */
  optionInfo: Record<string, ClozeOptionInfo>;
  /** Shown only in post-attempt feedback (PRD §1.2). */
  sentencePinyin?: string;
  translation?: string;
}

/** Blank sized to the answer, e.g. "＿＿＿" for 滷肉飯. */
export function clozeBlank(answer: string): string {
  return CLOZE_BLANK_CHAR.repeat(Math.max(1, Array.from(answer).length));
}

function sharesCharacter(a: string, b: string): boolean {
  const set = new Set(hanChars(a));
  return hanChars(b).some((c) => set.has(c));
}

/**
 * Distractors for a cloze must be READABLE deck words, so the sentence has
 * to be read to rule them out (grammar and meaning), plus at most one
 * look-alike foil to keep the eyes honest. Priority: same domain & length,
 * same domain, words sharing a character, then any deck word.
 */
export function pickClozeDistractors(
  card: VocabCard,
  pool: VocabCard[],
  count: number,
  rng: Rng = Math.random,
): string[] {
  const target = card.traditional;
  const targetLength = hanChars(target).length;
  const chosen: string[] = [];
  const seen = new Set<string>([target, ...(card.variants ?? [])]);
  const push = (candidates: string[], limit = count) => {
    for (const c of shuffle(candidates, rng)) {
      if (chosen.length >= limit) return;
      const value = c.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      chosen.push(value);
    }
  };

  const others = pool.filter(
    (c) => c.id !== card.id && c.traditional !== target && !isVariantOf(card, c.traditional),
  );
  const sameLength = (c: VocabCard) => hanChars(c.traditional).length === targetLength;
  const deckWords = (cards: VocabCard[]) => cards.map((c) => c.traditional);

  // Up to count-1 real words first, leaving one slot for a look-alike.
  const wordSlots = Math.max(1, count - 1);
  push(deckWords(others.filter((c) => c.domain === card.domain && sameLength(c))), wordSlots);
  push(deckWords(others.filter((c) => c.domain === card.domain)), wordSlots);
  push(deckWords(others.filter((c) => sharesCharacter(c.traditional, target))), wordSlots);
  push(deckWords(others.filter(sameLength)), wordSlots);
  push(deckWords(others), wordSlots);
  // One visual foil, then top up with any remaining deck words.
  push(
    (card.visualFoils ?? [])
      .map((f) => expandFoil(target, f))
      .filter((f): f is string => f !== null && !isVariantOf(card, f)),
  );
  push(deckWords(others));
  return chosen;
}

/** Build a cloze exercise, or null when the card has no usable sentence / options. */
export function buildClozeExercise(
  card: VocabCard,
  pool: VocabCard[],
  rng: Rng = Math.random,
): ClozeExercise | null {
  if (!hasClozeSentence(card)) return null;
  const sentence = card.exampleSentenceTraditional!.trim();
  const index = sentence.indexOf(card.traditional);
  const distractors = pickClozeDistractors(card, pool, CLOZE_OPTION_COUNT - 1, rng);
  if (distractors.length < 1) return null;
  const options = shuffle([card.traditional, ...distractors], rng);
  const optionInfo: Record<string, ClozeOptionInfo> = {};
  for (const option of options) {
    const match = option === card.traditional ? card : pool.find((c) => c.traditional === option);
    if (match) optionInfo[option] = { pinyin: match.pinyin, definition: match.definition };
  }
  return {
    type: 'cloze',
    cardId: card.id,
    before: sentence.slice(0, index),
    after: sentence.slice(index + card.traditional.length),
    options,
    answer: card.traditional,
    optionInfo,
    sentencePinyin: card.exampleSentencePinyin,
    translation: card.exampleSentenceTranslation,
  };
}
