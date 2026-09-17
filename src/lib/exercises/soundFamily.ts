import { charInfo } from '@/data/charInfo';
import { breakdown, shortGloss, type SoundMatch } from '@/lib/etymology';
import { hanChars, syllablesPerCharacter } from '@/lib/util/pinyin';
import { pick, shuffle, type Rng } from '@/lib/util/random';
import { CardState, type VocabCard } from '@/types';

export const SOUND_FAMILY_OPTION_COUNT = 4;
/** A family is worth asking about from this many deck siblings: three tiles at least. */
export const SOUND_FAMILY_MIN_SIBLINGS = 2;
export const SOUND_FAMILY_BLANK = '＿';

/**
 * The deck's characters grouped by the component that gives them their
 * reading (青 → 清 精 鯖 睛 情 請), as the composition table has it, and
 * each character's part. Built once per deck, after the table's chunk has
 * loaded; asking it needs the table no longer.
 */
export interface SoundFamilyIndex {
  /** Deck characters by the sound part they share, in code-point order. */
  families: ReadonlyMap<string, readonly string[]>;
  /** The sound part of each deck character that has one. */
  stemOf: ReadonlyMap<string, string>;
}

export function soundFamilyIndex(cards: readonly VocabCard[]): SoundFamilyIndex {
  const chars = new Set<string>();
  for (const card of cards) for (const ch of hanChars(card.traditional)) chars.add(ch);
  const families = new Map<string, string[]>();
  const stemOf = new Map<string, string>();
  for (const ch of chars) {
    const stem = breakdown(ch)?.sound?.char;
    if (!stem) continue;
    stemOf.set(ch, stem);
    const family = families.get(stem);
    if (family) family.push(ch);
    else families.set(stem, [ch]);
  }
  for (const family of families.values()) family.sort();
  return { families, stemOf };
}

/** An index from families written out by hand, for tests and fixtures. */
export function indexFromFamilies(entries: Record<string, readonly string[]>): SoundFamilyIndex {
  const families = new Map<string, readonly string[]>();
  const stemOf = new Map<string, string>();
  for (const [stem, chars] of Object.entries(entries)) {
    families.set(stem, [...chars].sort());
    for (const ch of chars) stemOf.set(ch, stem);
  }
  return { families, stemOf };
}

/** One tile's explanation: what the character says apart from its sound. */
export interface SoundFamilyMember {
  char: string;
  reading?: string;
  gloss?: string;
  /** The component that carries the meaning, and what it says. */
  meaningPart?: string;
  meaningGloss?: string;
  /** A deck word the character appears in. */
  word?: string;
}

/**
 * Mode 8: Sound Families. The word with one character missing, its reading
 * and meaning; the tiles are that character and deck characters built on
 * the same sound part (＿嬌 ào jiāo: 傲 敖 熬 遨). Every tile says the same
 * thing about the sound, so only the other half of the character — the part
 * that carries the meaning — can settle it. That is what turns 傲 from a
 * shape into 人 beside a sound part, and the next 敖-character into a
 * rearrangement of something already met.
 *
 * Graded like Spot the Character: a wrong tile is explained by its meaning
 * part, then the character has to be found again among reshuffled tiles.
 */
export interface SoundFamilyExercise {
  type: 'sound_family';
  cardId: string;
  word: string;
  /** Which character of the word is asked (position among the word's characters). */
  index: number;
  /** The word with that character blanked: ＿嬌. */
  masked: string;
  pinyin: string;
  definition: string;
  /** The sound part every tile shares, and its own reading when known. */
  stem: string;
  stemReading?: string;
  /** How the shared part's reading relates to the answer's, when the table says. */
  match?: SoundMatch;
  options: string[];
  answer: string;
  memberInfo: Record<string, SoundFamilyMember>;
}

export interface SoundFamilyChoice {
  index: number;
  char: string;
  stem: string;
  siblings: string[];
}

/** The characters of the word that have enough deck siblings to ask about. */
export function soundFamilyChoices(
  card: Pick<VocabCard, 'traditional'>,
  families: SoundFamilyIndex,
): SoundFamilyChoice[] {
  const chars = hanChars(card.traditional);
  const out: SoundFamilyChoice[] = [];
  chars.forEach((char, index) => {
    const stem = families.stemOf.get(char);
    if (!stem) return;
    const siblings = (families.families.get(stem) ?? []).filter(
      (c) => c !== char && !chars.includes(c),
    );
    if (siblings.length >= SOUND_FAMILY_MIN_SIBLINGS) out.push({ index, char, stem, siblings });
  });
  return out;
}

/** Whether the deck can ask about one of this word's characters by its family. */
export function hasSoundFamily(
  card: Pick<VocabCard, 'traditional'>,
  families: SoundFamilyIndex,
): boolean {
  return soundFamilyChoices(card, families).length > 0;
}

/** The word with its n-th Han character replaced by the blank. */
export function maskCharacter(word: string, index: number): string {
  let seen = -1;
  return Array.from(word)
    .map((ch) => {
      if (!hanChars(ch).length) return ch;
      seen += 1;
      return seen === index ? SOUND_FAMILY_BLANK : ch;
    })
    .join('');
}

function describeMember(
  char: string,
  pool: readonly VocabCard[],
  own: VocabCard | null,
  reading?: string,
): SoundFamilyMember {
  const info = charInfo(char);
  const b = breakdown(char);
  const member: SoundFamilyMember = { char };
  const r = reading ?? info?.pinyin;
  if (r) member.reading = r;
  if (info?.gloss) member.gloss = shortGloss(info.gloss);
  if (b?.meaning) {
    member.meaningPart = b.meaning.char;
    if (b.meaning.gloss) member.meaningGloss = shortGloss(b.meaning.gloss);
  }
  // A word the learner has studied that holds the character, the target's own first.
  const holder =
    own ??
    pool.find((c) => c.fsrs.state !== CardState.New && hanChars(c.traditional).includes(char)) ??
    pool.find((c) => hanChars(c.traditional).includes(char));
  if (holder) member.word = holder.traditional;
  return member;
}

/** Build a Sound Families exercise, or null when no character of the word has a family in the deck. */
export function buildSoundFamilyExercise(
  card: VocabCard,
  pool: readonly VocabCard[],
  families: SoundFamilyIndex,
  rng: Rng = Math.random,
): SoundFamilyExercise | null {
  const choices = soundFamilyChoices(card, families);
  const choice = pick(choices, rng);
  if (!choice) return null;
  const sound = breakdown(choice.char)?.sound;
  const siblings = shuffle(choice.siblings, rng).slice(0, SOUND_FAMILY_OPTION_COUNT - 1);
  const options = shuffle([choice.char, ...siblings], rng);
  const syllables = syllablesPerCharacter(card.traditional, card.pinyin);
  const memberInfo: Record<string, SoundFamilyMember> = {};
  for (const option of options) {
    memberInfo[option] =
      option === choice.char
        ? describeMember(option, pool, card, syllables?.[choice.index])
        : describeMember(option, pool, null);
  }
  return {
    type: 'sound_family',
    cardId: card.id,
    word: card.traditional,
    index: choice.index,
    masked: maskCharacter(card.traditional, choice.index),
    pinyin: card.pinyin,
    definition: card.definition,
    stem: choice.stem,
    ...(sound?.reading ? { stemReading: sound.reading } : {}),
    ...(sound ? { match: sound.match } : {}),
    options,
    answer: choice.char,
    memberInfo,
  };
}
