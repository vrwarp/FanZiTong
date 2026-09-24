import { CardState, type DomainCategory, type ExampleSentence, type VocabCard } from '@/types';
import { shuffle, type Rng } from '@/lib/util/random';
import { DAY_MS } from '@/lib/util/time';
import { hasMeaningCue, knockedDownToday, readToday } from '@/lib/queue/session';
import { nearSynonyms } from '@/lib/util/definitions';
import { readingOf, spokenCue } from '@/lib/util/spoken';
import { ownSentences, pickClozeDistractors, type ClozeOptionInfo } from './cloze';
import { isVariantOf } from './foil';

export const MEANING_OPTION_COUNT = 4;
export const MEANING_READING_COUNT = 4;
/** A word known by ear is asked by ear again after this long. */
export const BY_EAR_RECHECK_MS = 30 * DAY_MS;
/** A word not known by ear is asked again after this long, not in the same sitting. */
export const BY_EAR_RETRY_MS = DAY_MS;

export type MeaningOptionInfo = ClozeOptionInfo;

/** Which word a wrong reading belongs to, for the explanation. */
export interface MeaningReadingInfo {
  traditional: string;
  definition: string;
}

/**
 * Mode 5: from the meaning to the word. The cue is the definition alone —
 * never the sound, never the shape. Step one, when it is due, asks which
 * reading the word has (is it known by ear?); step two asks which of four
 * written words it is: the target, readable words from its own domain, and
 * one same-sound misspelling, graded exactly as Fill the Blank grades them.
 */
export interface MeaningExercise {
  type: 'meaning_to_form';
  cardId: string;
  definition: string;
  domain: DomainCategory;
  /**
   * Step one's readings with the word's own among them, or empty when the
   * ear check is not due (see `askByEar`).
   */
  readings: string[];
  /** The word's own reading: as heard when the card has one, else pinyin. */
  reading: string;
  readingInfo: Record<string, MeaningReadingInfo>;
  /** Step two's written words, the answer among them. */
  options: string[];
  answer: string;
  /** Pinyin + gloss for the options that are deck words, shown after answering. */
  optionInfo: Record<string, MeaningOptionInfo>;
  /** The one misspelling of the answer: only this pick is a miss on the target. */
  foil?: string;
  /** A sentence to show once the word is found. */
  sentence?: ExampleSentence;
}

export { readingOf } from '@/lib/util/spoken';

/**
 * Whether the ear check is due: never asked, or known long enough ago to be
 * worth asking again, or not known a day or more ago — and never on a day
 * the word has already been read, because the reveal put its reading on
 * screen and the ear would only be repeating the eye.
 */
export function askByEar(
  card: Pick<VocabCard, 'byEar' | 'lastPassAt' | 'lastAgainAt'>,
  now: Date,
): boolean {
  if (readToday(card, now) || knockedDownToday(card, now)) return false;
  const last = card.byEar;
  if (!last) return true;
  const age = now.getTime() - Date.parse(last.at);
  if (!Number.isFinite(age)) return true;
  return age >= (last.known ? BY_EAR_RECHECK_MS : BY_EAR_RETRY_MS);
}

export { contentWords, nearSynonyms } from '@/lib/util/definitions';

/** Build a Which Word exercise, or null when the deck cannot supply the options. */
export function buildMeaningExercise(
  card: VocabCard,
  pool: VocabCard[],
  rng: Rng = Math.random,
  opts: { avoid?: ReadonlySet<string>; now?: Date; askByEar?: boolean } = {},
): MeaningExercise | null {
  if (!hasMeaningCue(card)) return null;
  const now = opts.now ?? new Date();
  const avoid = opts.avoid ?? new Set<string>();
  // A word that means nearly the same thing is not a fair distractor in either step.
  const candidates = pool.filter(
    (c) => c.id === card.id || !nearSynonyms(card.definition, c.definition),
  );
  // The same readable words and misspelling Fill the Blank would offer, only
  // without a sentence to rule anything out: the meaning has to do that.
  const { words, foil } = pickClozeDistractors(
    card,
    candidates,
    MEANING_OPTION_COUNT - 1,
    rng,
    avoid,
    '',
  );
  if (words.length + (foil ? 1 : 0) < 2) return null;
  const options = shuffle([card.traditional, ...words, ...(foil ? [foil] : [])], rng);
  const optionInfo: Record<string, MeaningOptionInfo> = {};
  for (const option of options) {
    const match = option === card.traditional ? card : pool.find((c) => c.traditional === option);
    if (match) {
      optionInfo[option] = {
        pinyin: match.pinyin,
        definition: match.definition,
        spoken: spokenCue(match),
      };
    }
  }

  const reading = readingOf(card);
  const readingInfo: Record<string, MeaningReadingInfo> = {};
  let readings: string[] = [];
  if (opts.askByEar ?? askByEar(card, now)) {
    const seen = new Set([reading]);
    const add = (c: VocabCard) => {
      const r = readingOf(c);
      if (!r || seen.has(r) || readings.length >= MEANING_READING_COUNT - 1) return;
      seen.add(r);
      readings.push(r);
      readingInfo[r] = { traditional: c.traditional, definition: c.definition };
    };
    // The readings of the written options first — the same four words heard,
    // then read — and other words of the domain behind them.
    for (const word of words) {
      const c = pool.find((x) => x.traditional === word);
      if (c) add(c);
    }
    const more = candidates.filter(
      (c) =>
        c.id !== card.id &&
        c.domain === card.domain &&
        !avoid.has(c.traditional) &&
        !words.includes(c.traditional) &&
        !isVariantOf(card, c.traditional),
    );
    // Words the learner has studied first: a reading never met is not a
    // choice, it is noise, and the target would be the one familiar sound.
    const studied = (c: VocabCard) => c.fsrs.state !== CardState.New;
    for (const c of shuffle(more.filter(studied), rng)) add(c);
    for (const c of shuffle(
      more.filter((c) => !studied(c)),
      rng,
    ))
      add(c);
    readings = readings.length >= 2 ? shuffle([reading, ...readings], rng) : [];
  }

  const sentence = ownSentences(card)[0];
  return {
    type: 'meaning_to_form',
    cardId: card.id,
    definition: card.definition,
    domain: card.domain,
    readings,
    reading,
    readingInfo,
    options,
    answer: card.traditional,
    optionInfo,
    foil: foil ?? undefined,
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
