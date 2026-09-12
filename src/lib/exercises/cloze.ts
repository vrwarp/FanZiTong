import { CardState, type ExampleSentence, type SentenceShown, type VocabCard } from '@/types';
import { hanChars } from '@/lib/util/pinyin';
import { pick, shuffle, type Rng } from '@/lib/util/random';
import { DAY_MS } from '@/lib/util/time';
import { expandFoil, isVariantOf } from './foil';

export const CLOZE_BLANK_CHAR = '＿';
export const CLOZE_OPTION_COUNT = 4;
/**
 * Every blank is the same width. A blank sized to the answer told the learner
 * how many characters to look for before they had read a word of the sentence.
 */
export const CLOZE_BLANK_WIDTH = 3;
/** A sentence clozed within this long is not clozed again. */
export const SENTENCE_COOLDOWN_MS = 7 * DAY_MS;
/** How many recent showings a card remembers (see `noteSentenceShown`). */
export const SENTENCES_SHOWN_LIMIT = 12;

export interface ClozeOptionInfo {
  pinyin: string;
  definition: string;
  /** As-heard reading when that is what people say (蚵仔煎 → ô-á-tsian). */
  spoken?: string;
}

export interface ClozeExercise {
  type: 'cloze';
  cardId: string;
  /** The sentence the blank was cut from: the card's own, or a borrowed one. */
  sentence: string;
  /** When the sentence was borrowed from another card, that card. */
  hostCardId?: string;
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

/** The blank, the same width whatever the answer's length: "＿＿＿". */
export function clozeBlank(): string {
  return CLOZE_BLANK_CHAR.repeat(CLOZE_BLANK_WIDTH);
}

/**
 * A sentence a word can be shown in: one of the card's own, or one borrowed
 * from another card whose sentence happens to use the word.
 */
export interface SentenceCandidate {
  traditional: string;
  pinyin?: string;
  translation?: string;
  /** The card the sentence was authored on. */
  hostCardId: string;
  /** Whether the sentence belongs to the card itself. */
  own: boolean;
}

type SentenceUse = SentenceShown['via'];

function sentencesOf(card: VocabCard): ExampleSentence[] {
  const primary: ExampleSentence[] = card.exampleSentenceTraditional
    ? [
        {
          traditional: card.exampleSentenceTraditional,
          pinyin: card.exampleSentencePinyin,
          translation: card.exampleSentenceTranslation,
        },
      ]
    : [];
  return [...primary, ...(card.extraSentences ?? [])];
}

/**
 * The card's own sentences that contain the word: the primary one first, then
 * the extras, with repeats dropped.
 */
export function ownSentences(card: VocabCard): SentenceCandidate[] {
  const word = card.traditional;
  if (!word) return [];
  const out: SentenceCandidate[] = [];
  const seen = new Set<string>();
  for (const s of sentencesOf(card)) {
    const text = s.traditional.trim();
    if (!text || seen.has(text) || !text.includes(word)) continue;
    seen.add(text);
    out.push({
      traditional: text,
      pinyin: s.pinyin,
      translation: s.translation,
      hostCardId: card.id,
      own: true,
    });
  }
  return out;
}

/**
 * Sentences authored on OTHER cards that happen to contain the word: a second
 * frame for a word whose own card has only one. The word has to stand on its
 * own there — 貢丸 inside 貢丸湯 is not a sighting of 貢丸, so a sentence that
 * holds a longer deck word containing this one is left alone, and a
 * one-character word borrows nothing at all. Sentences from cards the learner
 * has already met come first: a borrowed frame should not also be the first
 * look at a stranger's sentence.
 */
export function borrowedSentences(card: VocabCard, pool: VocabCard[]): SentenceCandidate[] {
  const word = card.traditional;
  // A single character met inside someone else's sentence is more often part
  // of another word (讚 in 讚美, 蛤 in 蛤蜊) than the word itself, and no deck
  // can list every compound: one-character words keep to their own sentences.
  if (hanChars(word).length < 2) return [];
  const longer = pool
    .flatMap((c) => [c.traditional, ...(c.variants ?? [])])
    .filter((w) => w.length > word.length && w.includes(word));
  const seen = new Set(ownSentences(card).map((s) => s.traditional));
  const met: SentenceCandidate[] = [];
  const unmet: SentenceCandidate[] = [];
  for (const host of pool) {
    if (host.id === card.id) continue;
    for (const s of sentencesOf(host)) {
      const text = s.traditional.trim();
      if (!text || seen.has(text) || !text.includes(word)) continue;
      if (longer.some((w) => text.includes(w))) continue;
      seen.add(text);
      const candidate: SentenceCandidate = {
        traditional: text,
        pinyin: s.pinyin,
        translation: s.translation,
        hostCardId: host.id,
        own: false,
      };
      (host.fsrs.state === CardState.New ? unmet : met).push(candidate);
    }
  }
  return [...met, ...unmet];
}

/** When the card last showed this sentence (by the given routes), or 0 if never. */
function lastShownAt(card: VocabCard, text: string, uses?: readonly SentenceUse[]): number {
  let latest = 0;
  for (const shown of card.sentencesShown ?? []) {
    if (shown.text !== text) continue;
    if (uses && !uses.includes(shown.via)) continue;
    const at = Date.parse(shown.at);
    if (Number.isFinite(at) && at > latest) latest = at;
  }
  return latest;
}

/** The text of the sentence last shown by the given route, if any. */
function lastShownText(card: VocabCard, use: SentenceUse): string | null {
  let latest = 0;
  let text: string | null = null;
  for (const shown of card.sentencesShown ?? []) {
    if (shown.via !== use) continue;
    const at = Date.parse(shown.at);
    if (Number.isFinite(at) && at >= latest) {
      latest = at;
      text = shown.text;
    }
  }
  return text;
}

/** The first candidate with the smallest key; earlier candidates win ties. */
function leastRecent(
  candidates: SentenceCandidate[],
  key: (c: SentenceCandidate) => number,
): SentenceCandidate | null {
  let best: SentenceCandidate | null = null;
  let bestKey = Infinity;
  for (const c of candidates) {
    const k = key(c);
    if (k < bestKey) {
      best = c;
      bestKey = k;
    }
  }
  return best;
}

/**
 * Which sentence to show a word in now, out of its own and the borrowed ones.
 *
 * On the reveal: the one shown least recently, so a word with several frames
 * cycles through them (own sentences first among those never shown).
 *
 * For a cloze: a sentence not clozed in the last week — a frame the learner
 * has just filled in is recognised by its shape, not read — and by preference
 * not the one on the last reveal either. Null when every sentence is still
 * cooling off: the word sits this cloze out rather than repeat itself.
 */
export function chooseSentence(
  card: VocabCard,
  pool: VocabCard[],
  now: Date,
  via: SentenceUse,
): SentenceCandidate | null {
  const candidates = [...ownSentences(card), ...borrowedSentences(card, pool)];
  if (candidates.length === 0) return null;
  if (via === 'reveal') {
    return leastRecent(candidates, (c) => lastShownAt(card, c.traditional));
  }
  const at = now.getTime();
  const lastClozed = (c: SentenceCandidate) => lastShownAt(card, c.traditional, ['cloze']);
  const cool = candidates.filter((c) => at - lastClozed(c) >= SENTENCE_COOLDOWN_MS);
  if (cool.length === 0) return null;
  const lastReveal = lastShownText(card, 'reveal');
  const unseen = cool.filter((c) => c.traditional !== lastReveal);
  return leastRecent(unseen.length > 0 ? unseen : cool, lastClozed);
}

/**
 * Record that a sentence was shown for the card. Only the latest showing of
 * each sentence by each route is kept, and no more than
 * `SENTENCES_SHOWN_LIMIT` in all, newest last.
 */
export function noteSentenceShown(
  card: VocabCard,
  text: string,
  at: string,
  via: SentenceUse,
): VocabCard {
  const kept = (card.sentencesShown ?? []).filter((s) => !(s.text === text && s.via === via));
  const shown = [...kept, { text, at, via }].slice(-SENTENCES_SHOWN_LIMIT);
  return { ...card, sentencesShown: shown };
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
 * Within the domain, words that share a character with the answer come first:
 * when 餛飩湯 and 魚丸湯 sit beside 貢丸湯, spotting 湯 settles nothing and the
 * whole word has to be read.
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
  /** The sentence the blank is cut from; the card's primary one when absent. */
  sentenceText?: string,
): ClozeDistractors {
  const target = card.traditional;
  const targetLength = hanChars(target).length;
  const targetChars = new Set(hanChars(target));
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

  const sentence = sentenceText ?? card.exampleSentenceTraditional ?? '';
  const others = pool.filter(
    (c) =>
      c.id !== card.id &&
      c.traditional !== target &&
      !isVariantOf(card, c.traditional) &&
      !sentence.includes(c.traditional) &&
      !avoid.has(c.traditional),
  );
  const sameLength = (c: VocabCard) => hanChars(c.traditional).length === targetLength;
  const sharesChar = (c: VocabCard) => hanChars(c.traditional).some((ch) => targetChars.has(ch));
  const deckWords = (cards: VocabCard[]) => cards.map((c) => c.traditional);
  const tags = new Set(card.tags);
  const sameDomain = others.filter((c) => c.domain === card.domain);
  const sharedTag = sameDomain.filter((c) => c.tags.some((t) => tags.has(t)));

  // Up to count-1 real words first, leaving one slot for a same-sound foil.
  const wordSlots = Math.max(1, count - 1);
  push(card.clozeDistractors ?? [], wordSlots);
  push(deckWords(sharedTag.filter(sharesChar)), wordSlots);
  push(deckWords(sameDomain.filter(sharesChar)), wordSlots);
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

/**
 * Build a cloze exercise from the given sentence (the card's first own one
 * when none is given), or null when there is no usable sentence / options.
 */
export function buildClozeExercise(
  card: VocabCard,
  pool: VocabCard[],
  rng: Rng = Math.random,
  opts: { avoid?: ReadonlySet<string>; sentence?: SentenceCandidate } = {},
): ClozeExercise | null {
  const chosen = opts.sentence ?? ownSentences(card)[0] ?? null;
  if (!chosen) return null;
  const sentence = chosen.traditional.trim();
  const index = sentence.indexOf(card.traditional);
  if (index < 0) return null;
  const { words, foil } = pickClozeDistractors(
    card,
    pool,
    CLOZE_OPTION_COUNT - 1,
    rng,
    opts.avoid,
    sentence,
  );
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
    sentence,
    ...(chosen.own ? {} : { hostCardId: chosen.hostCardId }),
    before: sentence.slice(0, index),
    after: sentence.slice(index + card.traditional.length),
    options,
    answer: card.traditional,
    optionInfo,
    foil: foil ?? undefined,
    sentencePinyin: chosen.pinyin,
    translation: chosen.translation,
  };
}
