import { buildStarterDeck } from '@/data/starterDeck';
import { containsPinyin } from '@/lib/util/pinyin';
import { mulberry32 } from '@/lib/util/random';
import { makeCard, reviewState } from '@/test/factories';
import { CardState } from '@/types';
import { noteSentenceShown } from './cloze';
import { buildFindInTextExercise, coversTarget, pickPassageFillers } from './passage';

const now = new Date('2026-09-13T08:00:00.000Z');

/** Cards whose sentence readings line up word by word with their characters. */
function alignedPool() {
  return [
    makeCard(),
    makeCard({
      traditional: '牛肉麵',
      pinyin: 'niú ròu miàn',
      definition: 'Beef noodles',
      exampleSentenceTraditional: '這家牛肉麵很好吃。',
      exampleSentencePinyin: 'Zhè jiā niúròumiàn hěn hǎochī.',
      exampleSentenceTranslation: 'This place’s beef noodles are great.',
      fsrs: reviewState(),
    }),
    makeCard({
      traditional: '貢丸湯',
      pinyin: 'gòng wán tāng',
      definition: 'Meatball soup',
      exampleSentenceTraditional: '我要一碗貢丸湯。',
      exampleSentencePinyin: 'Wǒ yào yī wǎn gòngwántāng.',
    }),
    makeCard({
      traditional: '團契',
      pinyin: 'tuán qì',
      definition: 'Fellowship',
      domain: 'church',
      exampleSentenceTraditional: '我們教會每週五晚上有青年團契。',
      exampleSentencePinyin: 'Wǒmen jiàohuì měi zhōuwǔ wǎnshang yǒu qīngnián tuánqì.',
    }),
  ];
}

describe('buildFindInTextExercise', () => {
  it('hides the word in its own sentence among others from the same domain, studied first', () => {
    const pool = alignedPool();
    const card = pool[0];
    const ex = buildFindInTextExercise(card, pool, mulberry32(1), { now })!;
    expect(ex).not.toBeNull();
    expect(ex.type).toBe('find_in_text');
    expect(ex.reading).toBe('lǔ ròu fàn');
    expect(ex.definition).toBe(card.definition);
    expect(ex.sentence).toBe(card.exampleSentenceTraditional);
    expect(ex.hostCardId).toBeUndefined();
    // Two fillers, both food, the studied one first in preference — and never the target.
    expect(ex.sentences).toHaveLength(3);
    const texts = ex.sentences.map((s) => s.text);
    expect(texts).toContain('這家牛肉麵很好吃。');
    expect(texts).toContain('我要一碗貢丸湯。');
    expect(texts).not.toContain('我們教會每週五晚上有青年團契。');
    for (const s of ex.sentences.filter((s) => s.text !== ex.sentence)) {
      expect(s.text).not.toContain('滷肉飯');
    }
    // The target is one tappable word, and nothing on screen is a reading.
    const target = ex.sentences[ex.target.sentence];
    expect(target.text).toBe(ex.sentence);
    const hits = target.words.filter((w) => coversTarget(w, ex.target));
    expect(hits.map((w) => w.text)).toEqual(['滷肉飯']);
    expect(ex.target).toMatchObject({ start: 7, end: 10 });
    for (const s of ex.sentences) expect(containsPinyin(s.text)).toBe(false);
    // Deck words in the passage can be named on a wrong tap.
    expect(ex.wordInfo['牛肉麵']).toMatchObject({ pinyin: 'niú ròu miàn' });
    expect(ex.wordInfo['貢丸湯']).toMatchObject({ definition: 'Meatball soup' });
    expect(ex.wordInfo['滷肉飯']).toMatchObject({ pinyin: 'lǔ ròu fàn' });
  });

  it('keeps a sentence holding a word that must stay out of sight off the passage', () => {
    const pool = alignedPool();
    const fillers = pickPassageFillers(
      pool[0],
      pool,
      new Set(),
      new Set(['貢丸湯']),
      mulberry32(1),
    );
    // The same-domain sentence leads; another domain's fills the second slot.
    expect(fillers.map((s) => s.text)).toEqual([
      '這家牛肉麵很好吃。',
      '我們教會每週五晚上有青年團契。',
    ]);
    // With only the church sentence left it still stands beside the target.
    const fewer = pickPassageFillers(
      pool[0],
      pool,
      new Set(),
      new Set(['貢丸湯', '牛肉麵']),
      mulberry32(1),
    );
    expect(fewer.map((s) => s.text)).toEqual(['我們教會每週五晚上有青年團契。']);
  });

  it('is null when the word has no sentence that lines up, or nothing to stand beside it', () => {
    const pool = alignedPool();
    const unaligned = { ...pool[0], exampleSentencePinyin: 'lǔ ròu fàn' };
    expect(buildFindInTextExercise(unaligned, pool, mulberry32(1), { now })).toBeNull();
    expect(buildFindInTextExercise(pool[0], [pool[0]], mulberry32(1), { now })).toBeNull();
  });

  it('sits out while the word’s only sentence is cooling off from a cloze', () => {
    const pool = alignedPool();
    const clozed = noteSentenceShown(
      pool[0],
      pool[0].exampleSentenceTraditional!,
      new Date(now.getTime() - 3600_000).toISOString(),
      'cloze',
    );
    expect(buildFindInTextExercise(clozed, pool, mulberry32(1), { now })).toBeNull();
  });

  it('prefers sentences from studied cards of the same domain', () => {
    const pool = alignedPool();
    const studiedChurch = { ...pool[3], fsrs: reviewState() };
    const unstudiedFood = { ...pool[1], fsrs: { ...pool[1].fsrs, state: CardState.New } };
    const fillers = pickPassageFillers(
      pool[0],
      [pool[0], unstudiedFood, pool[2], studiedChurch],
      new Set(),
      new Set(),
      mulberry32(3),
      1,
    );
    // Same domain beats studied: the passage should read as one text.
    expect(fillers[0].text).toMatch(/牛肉麵|貢丸湯/);
  });

  it('can be built for nearly every card of the shipped deck', async () => {
    const deck = await buildStarterDeck();
    let built = 0;
    for (const card of deck) {
      const ex = buildFindInTextExercise(card, deck, mulberry32(5), { now });
      if (!ex) continue;
      built += 1;
      expect(ex.sentences.length).toBeGreaterThanOrEqual(2);
      const target = ex.sentences[ex.target.sentence];
      expect(target.words.some((w) => coversTarget(w, ex.target))).toBe(true);
    }
    expect(built / deck.length).toBeGreaterThan(0.95);
  }, 60_000);
});
