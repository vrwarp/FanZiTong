import { beforeAll, describe, expect, it } from 'vitest';
import { buildStarterDeck } from '@/data/starterDeck';
import { briefGloss, charInfo } from '@/data/charInfo';
import { breakdown, loadEtymologyTable } from './index';
import { dictionaryEntry, wordSenses } from './table';
import { otherSenses } from '@/lib/util/definitions';

beforeAll(() => loadEtymologyTable());

describe('the dictionary behind the character chips', () => {
  it('gives every character of every deck word a reading and a meaning', async () => {
    const deck = await buildStarterDeck();
    const missing = new Set<string>();
    for (const card of deck) {
      for (const ch of card.traditional) {
        if (!/\p{Script=Han}/u.test(ch)) continue;
        const info = charInfo(ch);
        if (!info?.pinyin || !info.gloss) missing.add(ch);
      }
    }
    expect(Array.from(missing)).toEqual([]);
  }, 30_000);

  it('gives every component a breakdown names a reading or a meaning', async () => {
    const deck = await buildStarterDeck();
    // Stroke groups no dictionary reads as characters: the honest answer for
    // these is silence (see src/data/components.ts), not an invented gloss.
    const strokes = new Set([...'龶⺊⺈⺌']);
    const bare = new Set<string>();
    for (const card of deck) {
      for (const ch of card.traditional) {
        for (const part of breakdown(ch)?.parts ?? []) {
          const info = charInfo(part.char);
          if (strokes.has(part.char)) continue;
          if (!part.gloss && !part.reading && !info?.gloss && !info?.pinyin) bare.add(part.char);
        }
      }
    }
    expect(Array.from(bare)).toEqual([]);
  }, 30_000);

  it('lets the hand-written entry win and falls back to the generated one', () => {
    // 肉 is hand-written, with a tell; 潛 is not, and comes from the dictionary.
    expect(charInfo('肉')).toMatchObject({ pinyin: 'ròu', tell: expect.stringContaining('肉') });
    expect(charInfo('潛')).toEqual({ pinyin: 'qián', gloss: 'to hide; secret, latent, hidden' });
    expect(charInfo('朁')).toMatchObject({ pinyin: 'cǎn' });
    expect(dictionaryEntry('忍')).toEqual({
      pinyin: 'rěn',
      gloss: 'to endure, to bear, to suffer, to tolerate',
    });
    // A bare stroke shape the dictionary has nothing to say about.
    expect(charInfo('⺈')).toBeUndefined();
  });

  it('cuts a gloss to its first clause for a chip', () => {
    expect(briefGloss('to hide; secret, latent, hidden')).toBe('to hide');
    expect(briefGloss('cart, vehicle; to move in a cart')).toBe('cart, vehicle');
    expect(briefGloss('water — liquids, and what is done with them')).toBe('water');
    expect(briefGloss('a very long first clause that would never fit on a chip at all')).toMatch(
      /…$/,
    );
  });
});

describe('the other senses of a word', () => {
  it('carries the meanings a card does not teach, and not the one it does', () => {
    expect(wordSenses('機車')).toEqual([
      'locomotive; train engine car',
      '(coll.) motorcycle',
      'damn!; crap!',
    ]);
    expect(wordSenses('潛水')).toEqual(['to dive', 'to go under water']);
    // A word whose only dictionary sense is the card's own has nothing to add.
    expect(wordSenses('滷肉飯')).toBeUndefined();
  });

  it('shows at most three, skipping the card’s sense and repeats', () => {
    expect(
      otherSenses('Annoying, hard to deal with (of a person)', [
        'locomotive; train engine car',
        '(coll.) motorcycle',
        'scooter; motorcycle',
        '(slang) hard to get along with; annoying',
        'damn!; crap!',
        'one more',
      ]),
    ).toEqual(['locomotive; train engine car', '(coll.) motorcycle', 'damn!; crap!']);
    expect(otherSenses('Braised pork rice', undefined)).toEqual([]);
    expect(otherSenses('To dive', ['to dive', 'to go under water'])).toEqual(['to go under water']);
  });
});
