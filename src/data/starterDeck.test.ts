import { CardState, DOMAIN_CATEGORIES } from '@/types';
import { containsHan, containsPinyin } from '@/lib/util/pinyin';
import {
  buildStarterDeck,
  loadStarterDeckData,
  starterDeckSize,
  starterRestoreLabel,
} from './starterDeck';
import type { StarterDeckData } from './starterDeck';

describe('starter deck', () => {
  let cards: Awaited<ReturnType<typeof buildStarterDeck>>;
  let entries: StarterDeckData['entries'];
  let size: number;
  beforeAll(async () => {
    cards = await buildStarterDeck({ now: new Date('2026-09-05T00:00:00.000Z') });
    ({ entries } = await loadStarterDeckData());
    size = await starterDeckSize();
  });

  it('covers the four PRD domains with a healthy number of cards each', () => {
    expect(cards).toHaveLength(size);
    expect(size).toBeGreaterThanOrEqual(90);
    for (const domain of ['food', 'church', 'slang', 'anime'] as const) {
      expect(entries[domain].length).toBeGreaterThanOrEqual(20);
      expect(cards.filter((c) => c.domain === domain).length).toBe(entries[domain].length);
    }
    expect(cards.every((c) => DOMAIN_CATEGORIES.includes(c.domain))).toBe(true);
  });

  it('has unique words, valid ids, new FSRS state and staggered creation order', () => {
    expect(new Set(cards.map((c) => c.traditional)).size).toBe(cards.length);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    expect(cards.every((c) => c.fsrs.state === CardState.New)).toBe(true);
    for (let i = 1; i < cards.length; i += 1) {
      expect(cards[i].createdAt > cards[i - 1].createdAt).toBe(true);
    }
  });

  it('every card is drill-ready: sentence contains the word, tone-marked pinyin, foils present', () => {
    for (const card of cards) {
      expect(containsHan(card.traditional)).toBe(true);
      expect(containsPinyin(card.traditional)).toBe(false);
      expect(card.pinyin).toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/);
      expect(card.definition.length).toBeGreaterThan(2);
      expect(card.exampleSentenceTraditional).toContain(card.traditional);
      expect(card.exampleSentencePinyin).toBeTruthy();
      expect(card.exampleSentenceTranslation).toBeTruthy();
      expect(card.visualFoils!.length).toBeGreaterThanOrEqual(2);
      expect(card.visualFoils).not.toContain(card.traditional);
      for (const v of card.variants ?? []) {
        expect(card.visualFoils).not.toContain(v);
        expect(v).not.toBe(card.traditional);
      }
      expect(card.tags.length).toBeGreaterThan(0);
    }
  });

  it('marks the famous real-world spellings as variants, not foils', () => {
    const byWord = new Map(cards.map((c) => [c.traditional, c]));
    expect(byWord.get('滷肉飯')?.variants).toEqual(['魯肉飯']);
    expect(byWord.get('鹹酥雞')?.variants).toEqual(['鹽酥雞']);
    expect(byWord.get('藉口')?.variants).toEqual(['借口']);
    expect(byWord.get('滷肉飯')?.visualFoils).not.toContain('魯肉飯');
    expect(byWord.get('爆雷')).toBeDefined();
    expect(byWord.get('劇透')).toBeUndefined();
    expect(byWord.get('ㄏㄏ')?.domain).toBe('slang');
  });

  it('supports an injectable id factory', async () => {
    let n = 0;
    const deck = await buildStarterDeck({ idFactory: () => `id-${(n += 1)}` });
    expect(deck[0].id).toBe('id-1');
  });
});

describe('the restore control', () => {
  it('says nothing while it does not know', () => {
    // The rows arrive as a chunk, so there is a moment — and, if the chunk
    // never arrives, longer than a moment — when the count is unknown. Saying
    // "complete" then is a claim made out of missing data.
    expect(starterRestoreLabel(null)).toBe('Restore starter deck');
  });

  it('offers to add what is missing, and admits when nothing is', () => {
    expect(starterRestoreLabel(12)).toBe('Restore starter deck (adds 12)');
    expect(starterRestoreLabel(0)).toBe('Restore starter deck (complete)');
  });
});
