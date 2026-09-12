import type { VocabCard } from '@/types';
import { hanChars } from '@/lib/util/pinyin';
import { pick, shuffle, type Rng } from '@/lib/util/random';
import { hasClozeSentence } from '@/lib/queue/session';
import { expandFoil, isVariantOf } from './foil';

export const CLOZE_BLANK_CHAR = '＿';
export const CLOZE_OPTION_COUNT = 4;

export interface ClozeOptionInfo {
  pinyin: string;
  definition: string;
  /** As-heard reading when that is what people say (蚵仔煎 → ô-á-tsian). */
  spoken?: string;
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
  /**
   * The one look-alike option (a misspelling of the answer). Only this pick is
   * a miss on the target; every other distractor is a readable word.
   */
  foil?: string;
  /** Shown only in post-attempt feedback (PRD §1.2). */
  sentencePinyin?: string;
  translation?: string;
}

/** Blank sized to the answer, e.g. "＿＿＿" for 滷肉飯. */
export function clozeBlank(answer: string): string {
  return CLOZE_BLANK_CHAR.repeat(Math.max(1, Array.from(answer).length));
}

export interface ClozeDistractors {
  /** Readable words the sentence rules out. */
  words: string[];
  /** The look-alike misspelling, when the card has a usable foil. */
  foil: string | null;
}

/**
 * Distractors for a cloze must be READABLE words that the sentence rules out.
 *
 * They come from the answer's OWN domain, preferring words that share a tag
 * with it. Drawing them from other domains — as this used to — guarantees no
 * distractor also fits the sentence, but it hands the learner a shortcut worth
 * more than reading: with the answer the only food word among church words,
 * "pick the one about food" beats chance by twenty-eight points. The risk it
 * was avoiding is already covered downstream: picking a real word that does
 * not fit is graded as a misreading of the sentence, not of the target, and
 * changes no schedule.
 *
 * One same-sound foil keeps the eyes on the characters — the spelling an IME
 * would have offered for this reading, when the card names one.
 */
export function pickClozeDistractors(
  card: VocabCard,
  pool: VocabCard[],
  count: number,
  rng: Rng = Math.random,
  /**
   * Words not to offer as readable options: the ones just drilled or about
   * to be met, so one word does not turn up in two drills in a row and a new
   * word is not shown with its reading before its first sight.
   */
  avoid: ReadonlySet<string> = new Set(),
): ClozeDistractors {
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

  const sentence = card.exampleSentenceTraditional ?? '';
  const others = pool.filter(
    (c) =>
      c.id !== card.id &&
      c.traditional !== target &&
      !isVariantOf(card, c.traditional) &&
      !sentence.includes(c.traditional) &&
      !avoid.has(c.traditional),
  );
  const sameLength = (c: VocabCard) => hanChars(c.traditional).length === targetLength;
  const deckWords = (cards: VocabCard[]) => cards.map((c) => c.traditional);
  const tags = new Set(card.tags);
  const sameDomain = others.filter((c) => c.domain === card.domain);
  const sharedTag = sameDomain.filter((c) => c.tags.some((t) => tags.has(t)));

  // Up to count-1 real words first, leaving one slot for a same-sound foil.
  const wordSlots = Math.max(1, count - 1);
  push(card.clozeDistractors ?? [], wordSlots);
  push(deckWords(sharedTag.filter(sameLength)), wordSlots);
  push(deckWords(sharedTag), wordSlots);
  push(deckWords(sameDomain.filter(sameLength)), wordSlots);
  push(deckWords(sameDomain), wordSlots);
  // Only when the domain cannot fill the slots does the rest of the deck.
  if (chosen.length < 2) push(deckWords(others), wordSlots);
  // One misspelling, when the card names one that is not an accepted spelling.
  // The same-sound candidates come first: they are what the learner would have
  // had to choose between when typing the word.
  const usable = (authored: readonly string[]) =>
    authored
      .map((f) => expandFoil(target, f))
      .filter((f): f is string => f !== null && !isVariantOf(card, f) && !seen.has(f));
  const foils = usable(card.homophoneFoils ?? []);
  const fallback = foils.length > 0 ? foils : usable(card.visualFoils ?? []);
  const foil = fallback.length > 0 ? pick(fallback, rng)! : null;
  if (foil) seen.add(foil);
  // Without a foil the last slot is one more readable word.
  const wordTarget = count - (foil ? 1 : 0);
  push(deckWords(sameDomain), wordTarget);
  if (chosen.length < wordTarget) push(deckWords(others), wordTarget);
  return { words: chosen, foil };
}

/** Build a cloze exercise, or null when the card has no usable sentence / options. */
export function buildClozeExercise(
  card: VocabCard,
  pool: VocabCard[],
  rng: Rng = Math.random,
  opts: { avoid?: ReadonlySet<string> } = {},
): ClozeExercise | null {
  if (!hasClozeSentence(card)) return null;
  const sentence = card.exampleSentenceTraditional!.trim();
  const index = sentence.indexOf(card.traditional);
  const { words, foil } = pickClozeDistractors(card, pool, CLOZE_OPTION_COUNT - 1, rng, opts.avoid);
  if (words.length + (foil ? 1 : 0) < 1) return null;
  const options = shuffle([card.traditional, ...words, ...(foil ? [foil] : [])], rng);
  const optionInfo: Record<string, ClozeOptionInfo> = {};
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
  return {
    type: 'cloze',
    cardId: card.id,
    before: sentence.slice(0, index),
    after: sentence.slice(index + card.traditional.length),
    options,
    answer: card.traditional,
    optionInfo,
    foil: foil ?? undefined,
    sentencePinyin: card.exampleSentencePinyin,
    translation: card.exampleSentenceTranslation,
  };
}
