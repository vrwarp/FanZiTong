import deck from '@/data/starterDeck.json';
import { materializeStarterDeck, type StarterDeckData } from '@/data/starterDeck';
import { mulberry32 } from '@/lib/util/random';
import type { VocabCard } from '@/types';
import { buildClozeExercise } from './cloze';
import {
  buildFoilExercise,
  centroidOption,
  isSilhouetteGuessable,
  positionModeString,
} from './foil';

/**
 * The guard.
 *
 * A discrimination drill is only measuring reading if a learner who cannot
 * read any of the options does no better than chance. Two strategies beat the
 * old generator on two drills in three without knowing a single character:
 * take the commonest glyph in each column, or take the option closest to all
 * the others. Both work for the same reason — every wrong option used to be a
 * one-character edit of the right one, which left the right one at the centre
 * of the set.
 *
 * This runs the real generator over the whole shipped deck rather than a
 * fixture, because the failure was a property of the deck's shape and a
 * handful of hand-written cards would not have shown it.
 */

const cards: VocabCard[] = materializeStarterDeck(deck as unknown as StarterDeckData, {
  now: new Date('2026-01-01T00:00:00.000Z'),
  idFactory: (() => {
    let n = 0;
    return () => {
      n += 1;
      return `card-${n}`;
    };
  })(),
});

const SEEDS = [1, 2, 3];

describe('foil option sets are not guessable without reading', () => {
  it('materialises the whole deck', () => {
    expect(cards.length).toBeGreaterThan(1900);
  });

  it('never lets the answer be the commonest glyph in every column', () => {
    const offenders: string[] = [];
    for (const seed of SEEDS) {
      const rng = mulberry32(seed);
      for (const card of cards) {
        const ex = buildFoilExercise(card, cards, rng);
        if (!ex) continue;
        if (positionModeString(ex.options) === ex.answer) {
          offenders.push(`${card.traditional}: ${ex.options.join(' ')}`);
        }
      }
    }
    expect(offenders.slice(0, 10)).toEqual([]);
  });

  it('never leaves the answer alone at the centre of the set', () => {
    const offenders: string[] = [];
    for (const seed of SEEDS) {
      const rng = mulberry32(seed);
      for (const card of cards) {
        const ex = buildFoilExercise(card, cards, rng);
        if (!ex) continue;
        if (centroidOption(ex.options) === ex.answer) {
          offenders.push(`${card.traditional}: ${ex.options.join(' ')}`);
        }
      }
    }
    expect(offenders.slice(0, 10)).toEqual([]);
  });

  it('builds a drill for nearly every card, and prefers homophones when it can', () => {
    const rng = mulberry32(11);
    let built = 0;
    let homophone = 0;
    const strategies = new Map<string, number>();
    for (const card of cards) {
      const ex = buildFoilExercise(card, cards, rng);
      if (!ex) continue;
      built += 1;
      if (ex.source === 'homophone') homophone += 1;
      strategies.set(ex.strategy, (strategies.get(ex.strategy) ?? 0) + 1);
    }
    // Coverage: padding a set with unrelated words is gone, so a card that
    // cannot make an honest set makes none. That must stay rare.
    expect(built / cards.length).toBeGreaterThan(0.97);
    // The IME confusion is the one worth drilling; shape is the fallback.
    expect(homophone / built).toBeGreaterThan(0.9);
    expect(strategies.get('factorial') ?? 0).toBeGreaterThan(0);
  });

  it('keeps every option the same length as the answer', () => {
    const rng = mulberry32(5);
    for (const card of cards) {
      const ex = buildFoilExercise(card, cards, rng);
      if (!ex) continue;
      const width = Array.from(ex.answer).length;
      for (const option of ex.options) {
        expect(Array.from(option).length).toBe(width);
      }
    }
  });

  it('never offers a real deck word or an accepted variant as a wrong answer', () => {
    const real = new Set<string>();
    for (const card of cards) {
      real.add(card.traditional);
      for (const v of card.variants ?? []) real.add(v);
    }
    const rng = mulberry32(7);
    for (const card of cards) {
      const ex = buildFoilExercise(card, cards, rng);
      if (!ex) continue;
      for (const option of ex.options) {
        if (option === ex.answer) continue;
        expect(real.has(option)).toBe(false);
      }
    }
  });
});

describe('cloze option sets are not guessable by topic', () => {
  /**
   * The mirror of the foil leak. Distractors used to be drawn from other
   * domains on purpose, so that none of them could also fit the sentence —
   * which meant "pick the one option that is about food" beat reading it.
   */
  it('draws its readable distractors from the answer’s own domain', () => {
    const byWord = new Map(cards.map((c) => [c.traditional, c]));
    const rng = mulberry32(3);
    let withWords = 0;
    let sameDomain = 0;
    for (const card of cards) {
      const ex = buildClozeExercise(card, cards, rng);
      if (!ex) continue;
      const words = ex.options.filter((o) => o !== ex.answer && o !== ex.foil && byWord.has(o));
      if (words.length === 0) continue;
      withWords += 1;
      if (words.every((w) => byWord.get(w)!.domain === card.domain)) sameDomain += 1;
    }
    expect(withWords).toBeGreaterThan(100);
    expect(sameDomain / withWords).toBeGreaterThan(0.9);
  });
});

describe('the balance predicate', () => {
  it('flags a star-shaped set and passes a crossed one', () => {
    // What the generator used to produce: three edits of one word.
    expect(isSilhouetteGuessable(['吐槽', '土槽', '吐嘈', '吐曹'], '吐槽')).toBe(true);
    // Two positions crossed: every glyph appears twice, nothing to count.
    expect(isSilhouetteGuessable(['吐槽', '土槽', '吐嘈', '土嘈'], '吐槽')).toBe(false);
    // One column, four glyphs: the varying column ties.
    expect(isSilhouetteGuessable(['豆漿', '豆醬', '豆薑', '豆講'], '豆漿')).toBe(false);
  });
});
