import type { VocabCard } from '@/types';
import { hanChars } from '@/lib/util/pinyin';
import { shuffle, type Rng } from '@/lib/util/random';
import { confusableIndex, expandToWord, singleCharDiff } from './confusables';

export const FOIL_OPTION_COUNT = 4;
/** A balanced set of three beats a padded set of four. */
export const FOIL_MIN_OPTION_COUNT = 3;

/** Which mistake the wrong options in a set are made of. */
export type FoilSource = 'homophone' | 'shape';

/**
 * How a set is balanced.
 *
 * - `factorial` — two positions crossed, so every glyph appears in half the
 *   options: 豆漿 / 逗漿 / 豆醬 / 逗醬. Both characters have to be known.
 * - `column` — one position, four different glyphs in it. The rest of the word
 *   is constant, which is what an IME candidate list looks like.
 * - `pair` — one position, three glyphs, for words with only two alternatives.
 */
export type FoilStrategy = 'factorial' | 'column' | 'pair';

export interface FoilExercise {
  type: 'foil_discrimination';
  cardId: string;
  /** The cue is the sound + meaning; the learner must pick the correct shape. */
  pinyin: string;
  definition: string;
  options: string[];
  answer: string;
  /** Which confusion the wrong options represent. */
  source: FoilSource;
  /** Which balanced shape the set was built in. */
  strategy: FoilStrategy;
}

/** True when `text` is one of the card's accepted alternative spellings. */
export function isVariantOf(card: VocabCard, text: string): boolean {
  return (card.variants ?? []).some((v) => v.trim() === text);
}

/**
 * Expand an authored foil into a full-length option for the target word.
 * Kept here because the cloze generator and the deck tooling both use it.
 */
export function expandFoil(target: string, foil: string): string | null {
  return expandToWord(target, foil);
}

/** One character position, and the glyphs that can legitimately stand in it. */
export interface FoilAxis {
  index: number;
  candidates: string[];
}

/**
 * Every option in a set is `target` with one or two characters swapped, so a
 * candidate is only usable if the swap produces a spelling that is
 * unambiguously wrong: not the target, not an accepted variant of it, and not
 * some other real word the learner could reasonably be reading.
 */
function usableSwap(
  target: string,
  card: VocabCard,
  isRealWord: (t: string) => boolean,
  index: number,
  glyph: string,
): boolean {
  const chars = hanChars(target);
  if (chars[index] === glyph) return false;
  const swapped = swapChar(chars, index, glyph);
  return swapped !== target && !isVariantOf(card, swapped) && !isRealWord(swapped);
}

function swapChar(chars: string[], index: number, glyph: string): string {
  const out = chars.slice();
  out[index] = glyph;
  return out.join('');
}

/** Glyphs authored on the card itself that differ from the target at one position. */
function authoredAxes(card: VocabCard, foils: readonly string[]): Map<number, Set<string>> {
  const out = new Map<number, Set<string>>();
  for (const foil of foils) {
    const expanded = expandToWord(card.traditional, foil);
    if (!expanded) continue;
    const diff = singleCharDiff(card.traditional, expanded);
    if (!diff) continue;
    let set = out.get(diff.index);
    if (!set) {
      set = new Set();
      out.set(diff.index, set);
    }
    set.add(diff.to);
  }
  return out;
}

/**
 * The positions of `card.traditional` that can carry a wrong glyph, for one
 * kind of confusion.
 *
 * Authored candidates come first because a human chose them; the pool-derived
 * ones fill in behind. For homophones that derivation is the point — the
 * deck's own per-character pinyin names every character that shares a reading,
 * which is the candidate list an IME would offer.
 */
export function foilAxes(
  card: VocabCard,
  pool: readonly VocabCard[],
  source: FoilSource,
): FoilAxis[] {
  const index = confusableIndex(pool);
  const chars = hanChars(card.traditional);
  const authored = authoredAxes(
    card,
    source === 'homophone' ? (card.homophoneFoils ?? []) : (card.visualFoils ?? []),
  );
  const axes: FoilAxis[] = [];
  chars.forEach((char, i) => {
    const candidates: string[] = [];
    const seen = new Set<string>();
    const push = (glyph: string) => {
      if (seen.has(glyph)) return;
      seen.add(glyph);
      if (usableSwap(card.traditional, card, index.isRealWord, i, glyph)) candidates.push(glyph);
    };
    for (const glyph of authored.get(i) ?? []) push(glyph);
    const derived = source === 'homophone' ? index.homophonesOf(char) : index.lookAlikesOf(char);
    for (const glyph of derived) push(glyph);
    if (candidates.length > 0) axes.push({ index: i, candidates });
  });
  return axes;
}

interface BuiltSet {
  options: string[];
  strategy: FoilStrategy;
}

/**
 * Arrange axes into a set in which the answer is statistically invisible.
 *
 * Every strategy leaves each varying column a tie, so counting glyphs down the
 * columns — or picking the option closest to all the others — says nothing. It
 * is not enough to choose good wrong answers: three single-character edits of
 * the target put the target at the centre of the set, and the centre is
 * findable without reading any of it.
 */
function arrange(target: string, axes: FoilAxis[], rng: Rng): BuiltSet | null {
  const chars = hanChars(target);
  const shuffled = shuffle(axes, rng);

  // Two positions crossed: every glyph appears in exactly two of four options.
  if (shuffled.length >= 2) {
    const [first, second] = shuffled;
    const a = shuffle(first.candidates, rng)[0];
    const b = shuffle(second.candidates, rng)[0];
    const one = swapChar(chars, first.index, a);
    const two = swapChar(chars, second.index, b);
    const both = swapChar(hanChars(one), second.index, b);
    const options = [target, one, two, both];
    if (new Set(options).size === FOIL_OPTION_COUNT) return { options, strategy: 'factorial' };
  }

  // One position, four glyphs: the varying column is a four-way tie.
  const wide = shuffled.find((axis) => axis.candidates.length >= FOIL_OPTION_COUNT - 1);
  if (wide) {
    const picked = shuffle(wide.candidates, rng).slice(0, FOIL_OPTION_COUNT - 1);
    const options = [target, ...picked.map((g) => swapChar(chars, wide.index, g))];
    if (new Set(options).size === FOIL_OPTION_COUNT) return { options, strategy: 'column' };
  }

  // Only two alternatives anywhere: three balanced tiles, not four padded ones.
  const pair = shuffled.find((axis) => axis.candidates.length >= FOIL_MIN_OPTION_COUNT - 1);
  if (pair) {
    const picked = shuffle(pair.candidates, rng).slice(0, FOIL_MIN_OPTION_COUNT - 1);
    const options = [target, ...picked.map((g) => swapChar(chars, pair.index, g))];
    if (new Set(options).size === FOIL_MIN_OPTION_COUNT) return { options, strategy: 'pair' };
  }

  return null;
}

/**
 * The wrong options for a card, or an empty list when none can be built.
 * Exposed for callers that only want the distractors; the ordering of a real
 * drill comes from `buildFoilExercise`.
 */
export function pickFoilOptions(
  card: VocabCard,
  pool: readonly VocabCard[],
  rng: Rng = Math.random,
): string[] {
  const built = buildFoilExercise(card, pool, rng);
  return built ? built.options.filter((o) => o !== card.traditional) : [];
}

/**
 * Build a discrimination drill, or null when the card supports no honest set.
 *
 * Homophones are tried first: picking the right characters for a reading you
 * already know is the mistake a heritage reader actually makes, and it is the
 * one an IME puts in front of them. Look-alike shapes are the fallback, and
 * only reach the screen when no same-sound set can be built.
 *
 * Returning null is a real answer. A card with no usable confusion is better
 * served by another drill than by a set padded with unrelated words, which the
 * learner can eliminate on silhouette alone.
 */
export function buildFoilExercise(
  card: VocabCard,
  pool: readonly VocabCard[],
  rng: Rng = Math.random,
): FoilExercise | null {
  const sources: FoilSource[] = ['homophone', 'shape'];
  for (const source of sources) {
    const built = arrange(card.traditional, foilAxes(card, pool, source), rng);
    if (!built) continue;
    return {
      type: 'foil_discrimination',
      cardId: card.id,
      pinyin: card.pinyin,
      definition: card.definition,
      options: shuffle(built.options, rng),
      answer: card.traditional,
      source,
      strategy: built.strategy,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Balance checks. Exported so the guard test measures the same thing the
// generator promises, rather than a restatement of it.
// ---------------------------------------------------------------------------

/**
 * The string made of the commonest glyph in each column, or null when any
 * column ties. A learner who cannot read the options can still count them,
 * and if this returns the answer the drill has been solved by arithmetic.
 */
export function positionModeString(options: readonly string[]): string | null {
  if (options.length === 0) return null;
  const rows = options.map((o) => Array.from(o));
  const width = rows[0].length;
  if (!rows.every((r) => r.length === width)) return null;
  let guess = '';
  for (let i = 0; i < width; i += 1) {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row[i], (counts.get(row[i]) ?? 0) + 1);
    let best = '';
    let bestCount = -1;
    let tied = false;
    for (const [glyph, count] of counts) {
      if (count > bestCount) {
        best = glyph;
        bestCount = count;
        tied = false;
      } else if (count === bestCount) {
        tied = true;
      }
    }
    if (tied) return null;
    guess += best;
  }
  return guess;
}

/**
 * The option needing the fewest character changes to reach all the others, or
 * null when several tie for it. Three edits of one word leave that word at the
 * centre of the set, which is the same giveaway seen from another angle.
 */
export function centroidOption(options: readonly string[]): string | null {
  if (options.length === 0) return null;
  const distance = (a: string, b: string): number => {
    const x = Array.from(a);
    const y = Array.from(b);
    if (x.length !== y.length) return Number.POSITIVE_INFINITY;
    let n = 0;
    for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) n += 1;
    return n;
  };
  let best: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let tied = false;
  for (const option of options) {
    const score = options.reduce((sum, other) => sum + distance(option, other), 0);
    if (score < bestScore) {
      best = option;
      bestScore = score;
      tied = false;
    } else if (score === bestScore) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/**
 * True when the answer can be found without reading it — because it holds the
 * commonest glyph in every column, or sits alone at the centre of the set.
 */
export function isSilhouetteGuessable(options: readonly string[], answer: string): boolean {
  return positionModeString(options) === answer || centroidOption(options) === answer;
}

export interface CharDiff {
  index: number;
  picked: string;
  correct: string;
}

/**
 * Character positions where a picked option differs from the answer, so
 * feedback can point at the exact glyph (內 vs 肉) instead of the whole word.
 * Returns an empty list when the strings have different lengths.
 */
export function diffCharacters(picked: string, correct: string): CharDiff[] {
  const a = Array.from(picked);
  const b = Array.from(correct);
  if (a.length !== b.length) return [];
  const diffs: CharDiff[] = [];
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) diffs.push({ index: i, picked: a[i], correct: b[i] });
  }
  return diffs;
}
