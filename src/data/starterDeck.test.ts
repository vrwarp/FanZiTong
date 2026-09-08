import { CardState, DOMAIN_CATEGORIES } from '@/types';
import { containsHan, containsPinyin } from '@/lib/util/pinyin';
import {
  buildStarterDeck,
  loadStarterDeckData,
  planStarterRestore,
  starterDeckSize,
  starterRestoreLabel,
  starterRestoreNotice,
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
  const now = new Date('2026-09-08T00:00:00.000Z');
  let shipped: Awaited<ReturnType<typeof buildStarterDeck>>;
  beforeAll(async () => {
    shipped = await buildStarterDeck({ now: new Date('2026-09-05T00:00:00.000Z') });
  });

  it('says nothing while it does not know', () => {
    // The rows arrive as a chunk, so there is a moment — and, if the chunk
    // never arrives, longer than a moment — when the answer is unknown. Saying
    // anything definite then is a claim made out of missing data.
    expect(starterRestoreLabel(null)).toBe('Restore starter deck');
  });

  it('has nothing to do for an untouched deck, and says so without saying "complete"', () => {
    const plan = planStarterRestore(shipped, shipped, { now });
    expect(plan.add).toHaveLength(0);
    expect(plan.repair).toHaveLength(0);
    // "complete" read as a verdict on the deck's size. This is a verdict on
    // whether this copy matches the shipped one, which is the actual question.
    expect(starterRestoreLabel(plan)).toBe('Restore starter deck (up to date)');
    expect(starterRestoreNotice(plan)).toMatch(/already matches the shipped one/);
  });

  it('offers to add the words a deck does not have', () => {
    const plan = planStarterRestore(shipped.slice(5), shipped, { now });
    expect(plan.add.map((c) => c.traditional)).toEqual(
      shipped.slice(0, 5).map((c) => c.traditional),
    );
    expect(starterRestoreLabel(plan)).toBe('Restore starter deck (adds 5)');
    expect(starterRestoreNotice(plan)).toMatch(/^Added 5 cards/);
  });

  // The reason the control existed at all was to get back to the shipped text,
  // and matching on the headword alone meant it never could: a card you had
  // edited, or one a later release corrected, counted as present and the button
  // went grey. There was no way back short of erasing the whole database.
  it('offers to put a drifted card back the way it ships', () => {
    const mine = shipped.map((card, i) =>
      i === 0 ? { ...card, definition: 'something I typed over it' } : card,
    );
    const plan = planStarterRestore(mine, shipped, { now });
    expect(plan.add).toHaveLength(0);
    expect(plan.repair).toHaveLength(1);
    expect(plan.repair[0].definition).toBe(shipped[0].definition);
    expect(starterRestoreLabel(plan)).toBe('Restore starter deck (repairs 1)');
    expect(starterRestoreNotice(plan)).toMatch(/restored 1 card to the shipped version/);
  });

  it('keeps the schedule the learner built while the words go back', () => {
    const reviewed = shipped.map((card, i) =>
      i === 0
        ? {
            ...card,
            id: 'card-i-have-been-studying',
            definition: 'drifted',
            createdAt: '2020-01-01T00:00:00.000Z',
            fsrs: { ...card.fsrs, state: CardState.Review, reps: 14, stability: 42 },
          }
        : card,
    );
    const [repaired] = planStarterRestore(reviewed, shipped, { now }).repair;
    expect(repaired.definition).toBe(shipped[0].definition);
    // Restoring content must never cost the reviews that were done on it.
    expect(repaired.id).toBe('card-i-have-been-studying');
    expect(repaired.createdAt).toBe('2020-01-01T00:00:00.000Z');
    expect(repaired.fsrs.reps).toBe(14);
    expect(repaired.fsrs.stability).toBe(42);
    expect(repaired.updatedAt).toBe(now.toISOString());
  });

  it('does not call an absent field a difference', () => {
    // The seed rows spell "nothing here" as undefined in one column and an
    // empty list in another, and a card that came back from JSON has been
    // through a round trip. None of that is an edit.
    const roundTripped = shipped.map((card) => ({
      ...card,
      visualFoils: card.visualFoils ?? [],
      variants: card.variants ?? [],
      notes: card.notes ?? undefined,
    }));
    expect(planStarterRestore(roundTripped, shipped, { now }).repair).toHaveLength(0);
  });

  it('reports both halves when it would do both', () => {
    const mine = shipped.slice(2).map((card, i) => (i === 0 ? { ...card, notes: 'mine' } : card));
    const plan = planStarterRestore(mine, shipped, { now });
    expect(starterRestoreLabel(plan)).toBe('Restore starter deck (adds 2, repairs 1)');
    expect(starterRestoreNotice(plan)).toBe(
      'Added 2 cards, restored 1 card to the shipped version from “Taiwanese Heritage Vocabulary (starter)”.',
    );
  });
});
