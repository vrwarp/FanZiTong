/**
 * The composition layer: what a character is built out of.
 *
 * The learner in the PRD reads by silhouette — 滷肉飯 is one shape they either
 * know or do not. This module breaks the silhouette into parts that recur, so
 * the next unfamiliar character is a rearrangement of things already met
 * rather than a new drawing: 氵 says it is about liquid, 鹵 says it sounds like
 * lǔ, and 滷 stops being arbitrary.
 *
 * TWO CLAIMS, AND ONE THING WE DO NOT CLAIM
 *
 * `meaning` says which component the writing system files the character under.
 * That is a fact about the script and it is what lets you guess a domain from
 * a shape you have never seen.
 *
 * `sound` says a component's own modern Mandarin reading still predicts this
 * character's — checked against the readings, not asserted from a table (see
 * scripts/build-etymology.mjs). It is deliberately narrow: many genuine
 * phonetic components stopped rhyming centuries ago, and this app only claims
 * the ones that would actually help someone guess a reading today.
 *
 * Neither is a claim about where the character came from. Origins are contested,
 * the popular ones are often folk etymology, and getting them right needs a
 * paleographer rather than a data file. For that we send the learner to
 * Chinese Etymology 字源, which has the oracle-bone, bronze and seal forms.
 */
import { componentInfo, type ComponentInfo } from '@/data/components';
import { charInfo } from '@/data/charInfo';
import { row } from './table';

/** How closely a component's modern reading predicts the character's. */
export type SoundMatch = 'exact' | 'tone' | 'rime';

const MATCH_CODES: Record<string, SoundMatch> = { e: 'exact', t: 'tone', r: 'rime' };

/** How a component's reading relates to the whole character's, in words. */
export const SOUND_MATCH_LABELS: Record<SoundMatch, string> = {
  exact: 'same reading',
  tone: 'same syllable, different tone',
  rime: 'rhymes with it',
};

export type PartRole = 'sound' | 'meaning' | 'part';

export interface BreakdownPart {
  char: string;
  /** Where it sits, when the layout says so unambiguously: "on the left". */
  position?: string;
  /** What it contributes to the meaning, when it is a component we can name. */
  gloss?: string;
  /** The full-size form, when this is a squeezed variant: 氵 → 水. */
  full?: string;
  /** Its own reading, when we know one. */
  reading?: string;
  role: PartRole;
}

export interface Breakdown {
  char: string;
  /** The Ideographic Description Sequence, e.g. "⿰氵鹵". */
  ids: string;
  parts: BreakdownPart[];
  /** The component the character is filed under, when we can gloss it. */
  meaning?: BreakdownPart;
  /** The component whose modern reading predicts this one's, when one does. */
  sound?: BreakdownPart & { match: SoundMatch };
}

const IDS_OPERATOR = /[⿰-⿿？]/u;

/**
 * Where each component sits, for the two-part layouts that have an everyday
 * name. Anything more nested is left unlabelled rather than described wrongly.
 */
const POSITIONS: Record<string, [string, string]> = {
  '⿰': ['on the left', 'on the right'],
  '⿱': ['on top', 'underneath'],
  '⿴': ['around the outside', 'inside'],
  '⿵': ['wrapped over the top', 'inside'],
  '⿶': ['wrapped underneath', 'inside'],
  '⿷': ['wrapped from the left', 'inside'],
  '⿸': ['over the top left', 'inside'],
  '⿹': ['over the top right', 'inside'],
  '⿺': ['around the bottom left', 'inside'],
};

function positions(ids: string): (string | undefined)[] {
  const chars = [...ids];
  const layout = POSITIONS[chars[0]];
  // Only the simple "operator + two whole components" case is described; a
  // nested sequence has no position we could name without guessing.
  if (!layout || chars.length !== 3 || IDS_OPERATOR.test(chars[1]) || IDS_OPERATOR.test(chars[2])) {
    return [];
  }
  return layout;
}

function reading(ch: string): string | undefined {
  return charInfo(ch)?.pinyin;
}

function gloss(ch: string): ComponentInfo | undefined {
  const component = componentInfo(ch);
  if (component) return component;
  // Not a radical, but a character in its own right that the deck can gloss.
  const info = charInfo(ch);
  return info?.gloss ? { gloss: info.gloss } : undefined;
}

/**
 * How this character is put together, or null when we have nothing worth
 * saying — including the moment before the table's chunk has loaded.
 * Absence is the normal case for the several hundred characters that
 * are single units rather than assemblies, and for any character whose only
 * decomposition is into bare strokes.
 */
export function breakdown(char: string): Breakdown | null {
  const raw = row(char);
  if (!raw) return null;
  const [ids, radical, soundChar, matchCode] = raw.split('|');
  const match = MATCH_CODES[matchCode];
  const where = positions(ids);
  const partChars = [...ids].filter((ch) => !IDS_OPERATOR.test(ch));

  const parts: BreakdownPart[] = partChars.map((ch, i) => {
    const info = gloss(ch);
    const isSound = ch === soundChar && !!match;
    // A component can be both; the reading is the more useful of the two to a
    // learner staring at a character they cannot pronounce, so it wins the label.
    const role: PartRole = isSound ? 'sound' : ch === radical && info ? 'meaning' : 'part';
    return {
      char: ch,
      position: where[i],
      gloss: info?.gloss,
      full: info?.full,
      reading: reading(ch),
      role,
    };
  });

  const soundPart = parts.find((p) => p.role === 'sound');
  const meaningPart = parts.find((p) => p.role === 'meaning');
  // Nothing survived the filter: a decomposition with no nameable part and no
  // usable reading is noise, not an explanation.
  if (!soundPart && !meaningPart) return null;

  return {
    char,
    ids,
    parts,
    ...(meaningPart ? { meaning: meaningPart } : {}),
    ...(soundPart && match ? { sound: { ...soundPart, match } } : {}),
  };
}

/**
 * The gloss without its elaboration: "money", not "money — from the cowrie
 * shells once used as currency". The long form earns its space in the panel
 * that shows one character; a line squeezed under a drill answer wants the
 * noun and nothing else.
 */
export function shortGloss(gloss: string): string {
  return gloss.split(' — ')[0];
}

/**
 * One line for the places that have room for a line: the drill feedback, the
 * leech list. Written to be read aloud, not parsed.
 */
export function describeBreakdown(b: Breakdown): string {
  const where = (p: BreakdownPart) => (p.position ? ` ${p.position}` : '');
  const bits: string[] = [];
  if (b.meaning?.gloss) {
    bits.push(`${b.meaning.char} (${shortGloss(b.meaning.gloss)})${where(b.meaning)}`);
  }
  if (b.sound) {
    const r = b.sound.reading ? ` ${b.sound.reading}` : '';
    bits.push(
      b.sound.match === 'exact'
        ? `${b.sound.char}${r}${where(b.sound)} gives the reading`
        : `${b.sound.char}${r}${where(b.sound)} gives the reading (${SOUND_MATCH_LABELS[b.sound.match]})`,
    );
  }
  return `${b.char} is ${bits.join(', ')}.`;
}

/**
 * Other characters built on the same sound component.
 *
 * This is the payoff of the whole layer: 青 turns 清 情 請 晴 from five
 * unrelated shapes into one family with one reading to remember. Restricted to
 * characters the learner's own deck contains, so it is a connection between
 * things they are already studying rather than a dictionary excursion.
 */
export function soundFamily(char: string, deckChars: Iterable<string>): string[] {
  const self = breakdown(char);
  if (!self?.sound) return [];
  const stem = self.sound.char;
  const seen = new Set<string>();
  const family: string[] = [];
  for (const other of deckChars) {
    if (other === char || seen.has(other)) continue;
    seen.add(other);
    if (breakdown(other)?.sound?.char === stem) family.push(other);
  }
  return family.sort();
}

export interface Contrast {
  /** Parts the first character has and the second does not. */
  aOnly: BreakdownPart[];
  /** Parts the second has and the first does not. */
  bOnly: BreakdownPart[];
}

/**
 * What actually differs between two characters a learner just confused.
 *
 * The foil drills are built on pairs like 滷/魯 and 飯/販, which differ in one
 * component. Naming that component turns "they look the same" into "one has
 * water in it and one has a fish", which is a difference you can hold on to.
 * Returns null unless both characters break down and they genuinely differ.
 */
export function contrast(a: string, b: string): Contrast | null {
  const left = breakdown(a);
  const right = breakdown(b);
  if (!left || !right) return null;
  const leftChars = left.parts.map((p) => p.char);
  const rightChars = right.parts.map((p) => p.char);
  const aOnly = left.parts.filter((p) => !rightChars.includes(p.char));
  const bOnly = right.parts.filter((p) => !leftChars.includes(p.char));
  if (!aOnly.length && !bOnly.length) return null;
  return { aOnly, bOnly };
}

/**
 * Chinese Etymology 字源 — Richard Sears' collection of oracle-bone, bronze and
 * seal forms, which is where the actual history lives.
 *
 * We link rather than embed: the images are his copyrighted work, there is no
 * API or redistributable dataset, and an offline-first app has no business
 * pretending it can show them with the network off.
 */
export function hanziyuanUrl(char: string): string {
  return `https://hanziyuan.net/#${encodeURIComponent(char)}`;
}

export { loadEtymologyTable, resetEtymologyTableForTests } from './table';
