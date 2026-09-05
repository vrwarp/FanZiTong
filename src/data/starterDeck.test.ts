import { CardState, DOMAIN_CATEGORIES } from '@/types';
import { containsHan, containsPinyin } from '@/lib/util/pinyin';
import { buildStarterDeck, STARTER_DECK_SIZE, STARTER_ENTRIES } from './starterDeck';

describe('starter deck', () => {
  const cards = buildStarterDeck({ now: new Date('2026-09-05T00:00:00.000Z') });

  it('covers the four PRD domains with a healthy number of cards each', () => {
    expect(cards).toHaveLength(STARTER_DECK_SIZE);
    expect(STARTER_DECK_SIZE).toBeGreaterThanOrEqual(80);
    for (const domain of ['food', 'church', 'slang', 'anime'] as const) {
      expect(STARTER_ENTRIES[domain].length).toBeGreaterThanOrEqual(20);
      expect(cards.filter((c) => c.domain === domain).length).toBe(STARTER_ENTRIES[domain].length);
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
      expect(card.tags.length).toBeGreaterThan(0);
    }
  });

  it('supports an injectable id factory', () => {
    let n = 0;
    const deck = buildStarterDeck({ idFactory: () => `id-${(n += 1)}` });
    expect(deck[0].id).toBe('id-1');
  });
});
