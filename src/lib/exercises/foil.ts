import type { VocabCard } from '@/types';
import { hanChars } from '@/lib/util/pinyin';
import { shuffle, type Rng } from '@/lib/util/random';

export const FOIL_OPTION_COUNT = 4;

export interface FoilExercise {
  type: 'foil_discrimination';
  cardId: string;
  /** The cue is the sound + meaning; the learner must pick the correct shape. */
  pinyin: string;
  definition: string;
  options: string[];
  answer: string;
}

/**
 * Expand an authored foil into a full-length option for the target word.
 * Same-length foils are used verbatim. A single-character foil for a
 * multi-character word replaces the first character (e.g. 滷肉飯 + 魯 → 魯肉飯),
 * which is where the confusable radical almost always lives in the PRD data.
 */
export function expandFoil(target: string, foil: string): string | null {
  const foilChars = hanChars(foil.trim());
  const targetChars = hanChars(target);
  if (foilChars.length === 0) return null;
  let candidate: string;
  if (foilChars.length === 1 && targetChars.length > 1) {
    candidate = [foilChars[0], ...targetChars.slice(1)].join('');
  } else {
    candidate = foilChars.join('');
  }
  return candidate === target ? null : candidate;
}

export function pickFoilOptions(
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
    for (const c of candidates) {
      if (chosen.length >= count) return;
      if (!c || seen.has(c)) continue;
      seen.add(c);
      chosen.push(c);
    }
  };

  push(
    shuffle(card.visualFoils ?? [], rng)
      .map((f) => expandFoil(target, f))
      .filter((f): f is string => f !== null),
  );
  const others = pool.filter((c) => c.id !== card.id && c.traditional !== target);
  const sameLength = others.filter((c) => hanChars(c.traditional).length === targetLength);
  push(
    shuffle(
      sameLength.filter((c) => c.domain === card.domain),
      rng,
    ).map((c) => c.traditional),
  );
  push(shuffle(sameLength, rng).map((c) => c.traditional));
  push(shuffle(others, rng).map((c) => c.traditional));
  return chosen;
}

/** Build a visual foil discrimination drill, or null if no foils can be produced. */
export function buildFoilExercise(
  card: VocabCard,
  pool: VocabCard[],
  rng: Rng = Math.random,
): FoilExercise | null {
  const foils = pickFoilOptions(card, pool, FOIL_OPTION_COUNT - 1, rng);
  if (foils.length === 0) return null;
  return {
    type: 'foil_discrimination',
    cardId: card.id,
    pinyin: card.pinyin,
    definition: card.definition,
    options: shuffle([card.traditional, ...foils], rng),
    answer: card.traditional,
  };
}
