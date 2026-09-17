import { CardState, type DomainCategory, type VocabCard } from '@/types';
import { alignSentenceReadings, type WordReading } from '@/lib/util/sentenceReadings';
import { shuffle, type Rng } from '@/lib/util/random';
import {
  chooseSentence,
  ownSentences,
  type ClozeOptionInfo,
  type SentenceCandidate,
} from './cloze';
import { readingOf } from './meaning';

/** Sentences shown beside the one that holds the word. */
export const PASSAGE_FILLER_COUNT = 2;

/** One sentence of the passage, cut into the words the reading segments it into. */
export interface PassageSentence {
  text: string;
  /** Each word is a tap target; the characters between them (punctuation) are not. */
  words: WordReading[];
  pinyin: string;
  translation?: string;
  /** The card the sentence was authored on. */
  hostCardId: string;
}

/**
 * Mode 7: Find It. A few real sentences, one of which uses the word; the
 * cue is the word's sound and meaning, and the answer is a tap on it in the
 * running text. This is reading the way a chat or a menu is read — skim,
 * segment, spot — with every other word in the passage as the distractor.
 *
 * Graded like Fill the Blank. The first wrong tap is a misreading of that
 * word, not of the target: it is named (its reading and, for a deck word,
 * its meaning), retired, and the learner looks again with no charge. A
 * second wrong tap is a miss on the target, and the word is shown.
 */
export interface FindInTextExercise {
  type: 'find_in_text';
  cardId: string;
  /** The word's reading: as heard when the card has one, else pinyin. */
  reading: string;
  definition: string;
  domain: DomainCategory;
  sentences: PassageSentence[];
  /** Where the word is: which sentence, and its character span (code points) in it. */
  target: { sentence: number; start: number; end: number };
  /** The sentence the word is in, for the record of sentences shown. */
  sentence: string;
  /** When that sentence was borrowed from another card, that card. */
  hostCardId?: string;
  /** Pinyin + gloss for the words of the passage that are deck words, for a wrong tap. */
  wordInfo: Record<string, ClozeOptionInfo>;
}

/** The sentence cut into words, when its reading lines up with its characters. */
export function alignedWords(sentence: Pick<SentenceCandidate, 'traditional' | 'pinyin'>) {
  return sentence.pinyin ? alignSentenceReadings(sentence.traditional, sentence.pinyin) : null;
}

/** Whether a word of the passage (by its span) overlaps the target. */
export function coversTarget(
  word: Pick<WordReading, 'text' | 'start'>,
  target: { start: number; end: number },
): boolean {
  const end = word.start + Array.from(word.text).length;
  return word.start < target.end && end > target.start;
}

function indexOfWord(chars: readonly string[], word: readonly string[]): number {
  for (let i = 0; i + word.length <= chars.length; i += 1) {
    let match = true;
    for (let j = 0; j < word.length; j += 1) {
      if (chars[i + j] !== word[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

function toPassageSentence(candidate: SentenceCandidate, words: WordReading[]): PassageSentence {
  return {
    text: candidate.traditional,
    words,
    pinyin: candidate.pinyin ?? '',
    translation: candidate.translation,
    hostCardId: candidate.hostCardId,
  };
}

/**
 * Other cards' sentences to show around the target's: ones that do not use
 * the word, from the same domain by preference (so the passage reads like
 * one text), from studied cards first, and never holding a word that must
 * stay out of sight — a queued word the learner has not met yet is not
 * shown before its first sight.
 */
export function pickPassageFillers(
  card: VocabCard,
  pool: VocabCard[],
  exclude: ReadonlySet<string>,
  avoid: ReadonlySet<string>,
  rng: Rng = Math.random,
  count: number = PASSAGE_FILLER_COUNT,
): PassageSentence[] {
  const word = card.traditional;
  const keepOut = Array.from(avoid).filter((w) => w && w !== word);
  const candidates: { sentence: SentenceCandidate; score: number }[] = [];
  const seen = new Set(exclude);
  for (const host of pool) {
    if (host.id === card.id) continue;
    for (const sentence of ownSentences(host)) {
      const text = sentence.traditional;
      if (!sentence.pinyin || seen.has(text) || text.includes(word)) continue;
      if (keepOut.some((w) => text.includes(w))) continue;
      seen.add(text);
      const score =
        (host.domain === card.domain ? 2 : 0) + (host.fsrs.state !== CardState.New ? 1 : 0);
      candidates.push({ sentence, score });
    }
  }
  const ordered = shuffle(candidates, rng).sort((a, b) => b.score - a.score);
  const fillers: PassageSentence[] = [];
  for (const { sentence } of ordered) {
    if (fillers.length >= count) break;
    const words = alignedWords(sentence);
    if (words) fillers.push(toPassageSentence(sentence, words));
  }
  return fillers;
}

/**
 * Build a Find It exercise, or null when the word has no sentence whose
 * reading lines up with its characters (a sentence is cut into words by its
 * reading), when every such sentence was clozed this week, or when no other
 * sentence can stand beside it.
 */
export function buildFindInTextExercise(
  card: VocabCard,
  pool: VocabCard[],
  rng: Rng = Math.random,
  opts: { avoid?: ReadonlySet<string>; now?: Date; sentence?: SentenceCandidate } = {},
): FindInTextExercise | null {
  const word = card.traditional;
  if (!word) return null;
  const now = opts.now ?? new Date();
  const avoid = opts.avoid ?? new Set<string>();
  const chosen =
    opts.sentence ?? chooseSentence(card, pool, now, 'cloze', (c) => alignedWords(c) !== null);
  if (!chosen) return null;
  const words = alignedWords(chosen);
  if (!words) return null;
  const chars = Array.from(chosen.traditional);
  const start = indexOfWord(chars, Array.from(word));
  if (start < 0) return null;
  const end = start + Array.from(word).length;

  const fillers = pickPassageFillers(card, pool, new Set([chosen.traditional]), avoid, rng);
  if (fillers.length === 0) return null;
  const targetSentence = toPassageSentence(chosen, words);
  const sentences = shuffle([targetSentence, ...fillers], rng);

  const wordInfo: Record<string, ClozeOptionInfo> = {};
  const describe = (c: VocabCard) => ({
    pinyin: c.pinyin,
    definition: c.definition,
    spoken: c.spoken,
  });
  for (const sentence of sentences) {
    for (const w of sentence.words) {
      if (wordInfo[w.text]) continue;
      const match = w.text === word ? card : pool.find((c) => c.traditional === w.text);
      if (match) wordInfo[w.text] = describe(match);
    }
  }
  wordInfo[word] = describe(card);

  return {
    type: 'find_in_text',
    cardId: card.id,
    reading: readingOf(card),
    definition: card.definition,
    domain: card.domain,
    sentences,
    target: { sentence: sentences.indexOf(targetSentence), start, end },
    sentence: chosen.traditional,
    ...(chosen.own ? {} : { hostCardId: chosen.hostCardId }),
    wordInfo,
  };
}
