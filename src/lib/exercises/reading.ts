import type { ExampleSentence, VocabCard } from '@/types';
import { hasReading } from '@/lib/queue/session';
import { syllablesPerCharacter } from '@/lib/util/pinyin';
import { displayReading } from '@/lib/util/sentenceReadings';
import { ownSentences } from './cloze';
import { readingOf } from './meaning';

/**
 * Mode 6: Say It. The cue is the characters alone, as in recognition, but
 * the answer is typed rather than self-rated: the reading has to be
 * produced, syllable by syllable, before anything is shown. Tones are not
 * asked for — typing tone marks on a phone is the obstacle, not the
 * knowledge — and ü may be written u or v, as an IME takes it.
 *
 * This is the one drill that is a reading. A first-try hit counts like a
 * recognition pass: it can move a word in Review, and after it the day's
 * verdict is in. A wrong try is shown syllable by syllable without the
 * answer and given one more go; right on the second try is recorded and
 * changes nothing; wrong twice, or giving up, is a miss.
 *
 * A word said the Taiwanese way (蚵仔煎 ô-á-tsian) may be typed that way, in
 * Tâi-lô or in POJ spelling, as well as in pinyin.
 *
 * And the pinyin may be spelled the way Taiwanese Mandarin sounds. One
 * learner's export had 很瞎 typed "heng xia", 反派 "fang pai", 關卡 "guang ka"
 * and 仔 "zhi": the -n/-ng merger and the retroflex merger (zh/z, ch/c, sh/s)
 * that mark Mandarin as spoken in Taiwan, marked wrong, and one of them
 * charged as a lapse. A heritage speaker who says hěng for 很 has read 很;
 * the standard spelling is shown afterwards, not demanded first. See
 * `accentKey`.
 */
export interface TypedReadingExercise {
  type: 'typed_reading';
  cardId: string;
  word: string;
  definition: string;
  /** The Mandarin reading one syllable per entry, as the feedback shows it. */
  syllables: string[];
  /** The pinyin readings a typed answer may match, normalized (see `normalizeReading`). */
  accepted: string[];
  /**
   * The same readings as accent keys (see `accentKey`): a typed answer that
   * meets one of these but none of `accepted` is a reading in a Taiwanese
   * accent, right, with the standard spelling to show.
   */
  acceptedAccent: string[];
  /** The as-heard reading, when the card has one that differs from the pinyin. */
  spoken?: string;
  /** The as-heard reading one syllable per entry, for marking a Taiwanese answer. */
  spokenSyllables?: string[];
  /** The as-heard readings a typed answer may match, as Taiwanese keys (see `taiwaneseKey`). */
  acceptedSpoken: string[];
  /** The reading to show once answered: as heard when the card has one, else pinyin. */
  reading: string;
  /** The Mandarin reading, shown beside `reading` when that is the as-heard one. */
  pinyin: string;
  /** A sentence to show once the word is read. */
  sentence?: ExampleSentence;
}

export interface SyllableMark {
  syllable: string;
  ok: boolean;
}

/**
 * A typed reading reduced to what is being asked: letters only, lowercase,
 * no tone marks or numbers, ü as u (and v, the IME spelling of ü, likewise),
 * no spaces, apostrophes or hyphens. "Lǔ ròu fàn", "lu3rou4fan4" and
 * "luroufan" are the same answer.
 */
export function normalizeReading(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/v/g, 'u')
    .replace(/[^a-z]/g, '');
}

/**
 * A Taiwanese reading reduced to one key, whichever way it was spelled.
 * Tâi-lô and POJ differ in a handful of regular ways — ts/ch, tsh/chh, ua/oa,
 * ue/oe, ik/ek, ing/eng, oo/o͘ — and both mark the nasal vowel (nn, ⁿ) and
 * the tones with signs nobody types on a phone. Each spelling is folded onto
 * the other symmetrically, so a reading typed with the syllables run together
 * still meets the card's hyphenated one: "ô-á-tsian", "o a chian", "oa tsian"
 * and "oatsian" all come out "oatsian".
 */
export function taiwaneseKey(input: string): string {
  return input
    .trim()
    .split(/[\s'’-]+/)
    .filter(Boolean)
    .map((token) =>
      normalizeReading(token)
        .replace(/chh/g, 'tsh')
        .replace(/ch/g, 'ts')
        .replace(/ua/g, 'oa')
        .replace(/ue/g, 'oe')
        .replace(/ing/g, 'eng')
        .replace(/ik/g, 'ek')
        .replace(/oo/g, 'o')
        .replace(/nn(?=[^aeiou]|$)/g, ''),
    )
    .join('');
}

/**
 * A pinyin reading reduced to how it sounds in Taiwanese Mandarin, so that
 * the spellings the accent produces meet the card's.
 *
 * Mandarin as spoken in Taiwan runs several standard distinctions together,
 * and a heritage speaker spelling what they say writes the merged sound:
 *
 * - the retroflex initials with the alveolar ones: zh/z (仔 zǐ typed "zhi"),
 *   ch/c, sh/s — not aspiration: 總 zǒng typed "cong" is a romanisation
 *   slip the syllable marks already catch, and folding z onto c would take
 *   自 for 次;
 * - the nasal finals -n and -ng: 很 hěn "heng", 反 fǎn "fang", 關 guān
 *   "guang", 心 xīn "xing";
 * - f said as hu- after the Hokkien pattern: 飯 fàn "huan", 福 fú "hu",
 *   飛 fēi "hui";
 * - eng after a labial said as ong: 風 fēng "fong" (and so "hong"), 夢 mèng
 *   "mong".
 *
 * Both sides are folded the same way, so "heng xia" and "hen xia" meet at
 * one key, and neither tells a reading from a misreading of the same
 * syllable pair (山 shān / 三 sān) — the cost accepted, because the drill
 * asks whether the characters were read, not whether the learner can spell
 * standard pinyin; the standard spelling is shown once they have.
 * Pinyin never begins a syllable with ng, so folding ng → n across a
 * run-together reading is safe.
 */
export function accentKey(input: string): string {
  return normalizeReading(input)
    .replace(/zh/g, 'z')
    .replace(/ch/g, 'c')
    .replace(/sh/g, 's')
    .replace(/(?<=[bpmf])eng/g, 'ong')
    .replace(/f(?=u|ong)/g, 'h')
    .replace(/f/g, 'hu')
    .replace(/huei/g, 'hui')
    .replace(/huen/g, 'hun')
    .replace(/ng/g, 'n');
}

/** How a typed reading met the card: standard pinyin, the Taiwanese reading, in a Taiwanese accent, or not. */
export type ReadingMatch = 'pinyin' | 'spoken' | 'accent' | null;

/**
 * Which accepted reading a typed answer meets, the strict spellings first:
 * the pinyin however it was typed, the as-heard reading in Tâi-lô or POJ, or
 * the pinyin as a Taiwanese accent spells it. An accent match is a reading
 * and is graded as one; it is told apart only so the standard spelling can
 * be pointed out.
 */
export function matchReading(
  typed: string,
  exercise: Pick<TypedReadingExercise, 'accepted' | 'acceptedSpoken' | 'acceptedAccent'>,
): ReadingMatch {
  const value = normalizeReading(typed);
  if (value.length > 0 && exercise.accepted.includes(value)) return 'pinyin';
  const key = taiwaneseKey(typed);
  if (key.length > 0 && exercise.acceptedSpoken.includes(key)) return 'spoken';
  const accent = accentKey(typed);
  if (accent.length > 0 && exercise.acceptedAccent.includes(accent)) return 'accent';
  return null;
}

/** The as-heard reading cut into syllables: Tâi-lô joins them with hyphens. */
export function spokenSyllablesOf(spoken: string): string[] {
  return spoken
    .trim()
    .split(/[\s-]+/)
    .filter((s) => normalizeReading(s).length > 0);
}

/**
 * Whether a typed answer is one of the readings the exercise accepts as
 * spelled: the pinyin however it was typed, or the as-heard reading in
 * Tâi-lô or POJ. `matchReading` adds the accent spellings.
 */
export function readingMatches(
  typed: string,
  accepted: readonly string[],
  acceptedSpoken: readonly string[] = [],
): boolean {
  const value = normalizeReading(typed);
  if (value.length > 0 && accepted.includes(value)) return true;
  const key = taiwaneseKey(typed);
  return key.length > 0 && acceptedSpoken.includes(key);
}

/**
 * Which syllables the typed answer got, so the feedback can point at the
 * second syllable rather than the whole word. Typed one syllable per space,
 * as the prompt asks, syllables are compared one to one; run together, the
 * reading is consumed from the front and a wrong syllable is skipped up to
 * where the next one begins. `normalize` says how a syllable is reduced for
 * the comparison: pinyin by default, the Taiwanese key for an as-heard reading.
 */
export function markSyllables(
  typed: string,
  syllables: readonly string[],
  normalize: (s: string) => string = normalizeReading,
): SyllableMark[] {
  const expected = syllables.map(normalize);
  const tokens = typed
    .trim()
    .split(/[\s'’-]+/)
    .map(normalize)
    .filter(Boolean);
  if (tokens.length === expected.length) {
    return expected.map((s, i) => ({ syllable: syllables[i], ok: tokens[i] === s }));
  }
  let rest = tokens.join('');
  return expected.map((s, i) => {
    if (s && rest.startsWith(s)) {
      rest = rest.slice(s.length);
      return { syllable: syllables[i], ok: true };
    }
    const next = expected[i + 1];
    const cut = next ? rest.indexOf(next) : -1;
    rest = cut >= 0 ? rest.slice(cut) : rest.slice(Math.min(rest.length, s.length));
    return { syllable: syllables[i], ok: false };
  });
}

/** Which reading a wrong try was marked against. */
export type MarkedReading = 'pinyin' | 'spoken';

/**
 * Mark a wrong try against the reading it was closest to: the pinyin, or the
 * as-heard reading when the word has one and the answer matches more of it.
 * A learner who typed "o a chian" for 蚵仔煎 is told which Taiwanese syllable
 * is off, not that every Mandarin one is.
 */
export function markReading(
  typed: string,
  exercise: Pick<TypedReadingExercise, 'syllables' | 'spokenSyllables'>,
): { marks: SyllableMark[]; against: MarkedReading } {
  const pinyin = markSyllables(typed, exercise.syllables);
  if (!exercise.spokenSyllables?.length) return { marks: pinyin, against: 'pinyin' };
  const spoken = markSyllables(typed, exercise.spokenSyllables, taiwaneseKey);
  const hits = (marks: SyllableMark[]) => marks.filter((m) => m.ok).length;
  return hits(spoken) > hits(pinyin)
    ? { marks: spoken, against: 'spoken' }
    : { marks: pinyin, against: 'pinyin' };
}

/** The reading cut into syllables: one per character when they line up, else by the syllable rule. */
export function readingSyllables(card: Pick<VocabCard, 'traditional' | 'pinyin'>): string[] {
  const pinyin = card.pinyin.trim();
  return (
    syllablesPerCharacter(card.traditional, pinyin) ??
    displayReading(pinyin)
      .split(' ')
      .filter((s) => normalizeReading(s).length > 0)
  );
}

/** Build a Say It exercise, or null when the card has no reading to ask for. */
export function buildTypedReadingExercise(
  card: VocabCard,
  opts: { sentence?: ExampleSentence } = {},
): TypedReadingExercise | null {
  if (!hasReading(card)) return null;
  const pinyin = card.pinyin.trim();
  const accepted = [normalizeReading(pinyin)].filter(Boolean);
  const syllables = readingSyllables(card);
  if (accepted.length === 0 || syllables.length === 0) return null;
  const acceptedAccent = [accentKey(pinyin)].filter(Boolean);
  const spoken = card.spoken?.trim();
  const spokenKey = spoken ? taiwaneseKey(spoken) : '';
  const acceptedSpoken = spokenKey ? [spokenKey] : [];
  const sentence = opts.sentence ?? ownSentences(card)[0];
  return {
    type: 'typed_reading',
    cardId: card.id,
    word: card.traditional,
    definition: card.definition,
    syllables,
    accepted,
    acceptedAccent,
    ...(spoken && spokenKey
      ? { spoken, spokenSyllables: spokenSyllablesOf(spoken), acceptedSpoken }
      : { acceptedSpoken }),
    reading: readingOf(card),
    pinyin,
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
