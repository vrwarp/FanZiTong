import { buildStarterDeck } from './starterDeck';
import { charInfo } from './charInfo';
import { MENU_CATEGORIES, categorizeDish } from './menuTemplate';
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

  it('keeps readings out of definitions', () => {
    const offenders = deck
      // Mandarin tone marks or Tâi-lô/POJ diacritics inside a definition mean a
      // reading was pasted where the meaning belongs (it goes in `spoken`).
      .filter((c) => /[áǎàéěèíǐìóǒòúǔùâêôû\u0304\u030d]/.test(c.definition))
      .map((c) => `${c.traditional}: ${c.definition}`);
    expect(offenders).toEqual([]);
  });
});
