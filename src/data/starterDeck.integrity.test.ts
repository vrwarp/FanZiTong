import { buildStarterDeck } from './starterDeck';
import { charInfo } from './charInfo';
import { MENU_CATEGORIES, categorizeDish, priceFor, shopsFor } from './menuTemplate';
import { MENU_MAX_ROWS, buildMenuExercise, groupCardsByShop } from '@/lib/exercises/menu';
import { mulberry32 } from '@/lib/util/random';
import { expandFoil, diffCharacters } from '@/lib/exercises/foil';
import { alignSentenceReadings } from '@/lib/util/sentenceReadings';

/**
 * Content checks the drills rely on: every sentence's pinyin lines up with
 * its characters (per-word tap readings), every character a foil or a
 * menu neighbour differs by has an entry in the character table (so the
 * contrast line can name it), and definitions carry meaning only.
 */
describe('starter deck integrity', () => {
  const deck = buildStarterDeck();

  it('aligns every example sentence with its pinyin, word by word', () => {
    const failures: string[] = [];
    for (const card of deck) {
      if (!card.exampleSentenceTraditional || !card.exampleSentencePinyin) continue;
      const words = alignSentenceReadings(
        card.exampleSentenceTraditional,
        card.exampleSentencePinyin,
      );
      if (!words) failures.push(`${card.traditional}: ${card.exampleSentenceTraditional}`);
    }
    expect(failures).toEqual([]);
  });

  it('has character info for every character a look-alike differs by', () => {
    const missing = new Set<string>();
    for (const card of deck) {
      for (const foil of card.visualFoils ?? []) {
        const expanded = expandFoil(card.traditional, foil);
        if (!expanded) continue;
        for (const d of diffCharacters(expanded, card.traditional)) {
          if (!charInfo(d.picked)) missing.add(d.picked);
          if (!charInfo(d.correct)) missing.add(d.correct);
        }
      }
    }
    expect(Array.from(missing).sort()).toEqual([]);
  });

  it('has character info for every character a same-section menu neighbour differs by', () => {
    const missing = new Set<string>();
    const food = deck.filter((c) => c.domain === 'food');
    for (const card of food) {
      const section = categorizeDish(card.traditional);
      const fillers = MENU_CATEGORIES.find((c) => c.id === section)?.fillers ?? [];
      for (const filler of fillers) {
        if (Array.from(filler.label).length !== Array.from(card.traditional).length) continue;
        for (const d of diffCharacters(filler.label, card.traditional)) {
          if (!charInfo(d.picked)) missing.add(d.picked);
          if (!charInfo(d.correct)) missing.add(d.correct);
        }
      }
    }
    expect(Array.from(missing).sort()).toEqual([]);
  });

  it('never ships a foil that renders as its headword or a variant', () => {
    const invisible = (a: string, b: string) => {
      const x = Array.from(a.normalize('NFC'));
      const y = Array.from(b.normalize('NFC'));
      if (x.length !== y.length) return false;
      return x.every((ch, i) => ch === y[i] || new Set(['口囗', '囗口']).has(ch + y[i]));
    };
    const offenders: string[] = [];
    for (const card of deck) {
      const real = [card.traditional, ...(card.variants ?? [])];
      for (const foil of card.visualFoils ?? []) {
        const expanded = expandFoil(card.traditional, foil) ?? foil;
        if (real.some((r) => invisible(expanded, r)))
          offenders.push(`${card.traditional}: ${foil}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses one romanisation for as-heard readings (Tâi-lô, never POJ ch-)', () => {
    const offenders = deck
      .filter((c) => c.spoken && /ch/.test(c.spoken))
      .map((c) => `${c.traditional}: ${c.spoken}`);
    expect(offenders).toEqual([]);
  });

  it('prints a same-section neighbour for every food word it can order', () => {
    const food = deck.filter((c) => c.domain === 'food');
    const missing: string[] = [];
    for (const card of food) {
      const ex = buildMenuExercise([card], mulberry32(3));
      if (!ex) continue;
      const items = ex.categories.flatMap((c) => c.items);
      if (!items.some((i) => i.neighbourOf === card.id)) missing.push(card.traditional);
      expect(items.length).toBeLessThanOrEqual(MENU_MAX_ROWS);
    }
    expect(missing).toEqual([]);
  });

  it('groups slip orders by the shop that sells them', () => {
    const food = deck.filter((c) => c.domain === 'food');
    for (const group of groupCardsByShop(food, mulberry32(5))) {
      const shops = group.map((c) => shopsFor(categorizeDish(c.traditional)));
      const common = shops.reduce((acc, list) => acc.filter((s) => list.includes(s)));
      expect(common.length).toBeGreaterThan(0);
      expect(group.length).toBeLessThanOrEqual(3);
      const ex = buildMenuExercise(group, mulberry32(5))!;
      expect(common).toContain(ex.shop.type);
    }
  });

  it('prices a broth-only noodle below the meat version and small below large', () => {
    const offenders: string[] = [];
    const priced = new Map<string, number | [number, number]>();
    for (const category of MENU_CATEGORIES) {
      for (const f of category.fillers) priced.set(f.label, f.price);
    }
    for (const card of deck.filter((c) => c.domain === 'food')) {
      const category = MENU_CATEGORIES.find((c) => c.id === categorizeDish(card.traditional));
      if (category) priced.set(card.traditional, priceFor(card.traditional, category.defaultPrice));
    }
    const low = (p: number | [number, number]) => (Array.isArray(p) ? p[0] : p);
    for (const [label, price] of priced) {
      if (Array.isArray(price) && price[0] >= price[1]) offenders.push(`${label}: 小 ≥ 大`);
      const soupVersion = label.replace(/麵$/, '湯麵');
      if (soupVersion !== label && priced.has(soupVersion)) {
        if (low(priced.get(soupVersion)!) >= low(price))
          offenders.push(`${soupVersion} ≥ ${label}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps definitions short enough to survive the slip cue', () => {
    const offenders = deck
      .filter((c) => c.definition.length > 60)
      .map((c) => `${c.traditional}: ${c.definition}`);
    expect(offenders).toEqual([]);
  });

  it('keeps readings out of definitions', () => {
    const offenders = deck
      // Mandarin tone marks or Tâi-lô/POJ diacritics inside a definition mean a
      // reading was pasted where the meaning belongs (it goes in `spoken`).
      .filter((c) => /[áǎàéěèíǐìóǒòúǔùâêôû]|\u0304|\u030d/.test(c.definition))
      .map((c) => `${c.traditional}: ${c.definition}`);
    expect(offenders).toEqual([]);
  });
});
