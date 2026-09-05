import type { VocabCard } from '@/types';
import { hanChars } from '@/lib/util/pinyin';
import { shuffle, type Rng } from '@/lib/util/random';
import { hasClozeSentence } from '@/lib/queue/session';

export const CLOZE_BLANK = '＿＿';
export const CLOZE_OPTION_COUNT = 4;

export interface ClozeExercise {
  type: 'cloze';
  cardId: string;
  /** Sentence text before / after the blank. */
  before: string;
  after: string;
  options: string[];
  answer: string;
  /** Shown only in post-attempt feedback (PRD §1.2). */
  sentencePinyin?: string;
  translation?: string;
}

function sharesCharacter(a: string, b: string): boolean {
  const set = new Set(hanChars(a));
  return hanChars(b).some((c) => set.has(c));
}

/**
 * Pick distractor words for a target from (in priority order):
 * word-length visual foils, other cards sharing a character, same-domain
 * cards of the same length, then any other card.
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
  const seen = new Set<string>([target]);
  const push = (candidates: string[]) => {
    for (const c of shuffle(candidates, rng)) {
      if (chosen.length >= count) return;
      const value = c.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      chosen.push(value);
    }
  };

  const others = pool.filter((c) => c.id !== card.id && c.traditional !== target);
  const sameLength = (c: VocabCard) => hanChars(c.traditional).length === targetLength;

  push((card.visualFoils ?? []).filter((f) => hanChars(f).length === targetLength));
  push(others.filter((c) => sharesCharacter(c.traditional, target)).map((c) => c.traditional));
  push(others.filter((c) => c.domain === card.domain && sameLength(c)).map((c) => c.traditional));
  push(others.filter(sameLength).map((c) => c.traditional));
  push(others.map((c) => c.traditional));
  push(card.visualFoils ?? []);
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
  return {
    type: 'cloze',
    cardId: card.id,
    before: sentence.slice(0, index),
    after: sentence.slice(index + card.traditional.length),
    options,
    answer: card.traditional,
    sentencePinyin: card.exampleSentencePinyin,
    translation: card.exampleSentenceTranslation,
  };
}
