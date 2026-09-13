import { mulberry32 } from '@/lib/util/random';
import { containsPinyin } from '@/lib/util/pinyin';
import { buildStarterDeck } from '@/data/starterDeck';
import { makeCard, makePool } from '@/test/factories';
import {
  askByEar,
  BY_EAR_RECHECK_MS,
  BY_EAR_RETRY_MS,
  buildMeaningExercise,
  contentWords,
  MEANING_OPTION_COUNT,
  MEANING_READING_COUNT,
  nearSynonyms,
} from './meaning';

const now = new Date('2026-09-13T08:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe('buildMeaningExercise', () => {
  const pool = [
    ...makePool(),
    makeCard({ traditional: '魚丸湯', pinyin: 'yú wán tāng', definition: 'Fish ball soup' }),
    makeCard({ traditional: '餛飩湯', pinyin: 'hún tun tāng', definition: 'Wonton soup' }),
    makeCard({
      traditional: '肉圓',
      pinyin: 'ròu yuán',
      spoken: 'bah-uân',
      definition: 'Taiwanese meatball in translucent dough',
    }),
  ];

  it('cues with the meaning alone and offers written words plus one misspelling', () => {
    const card = pool.find((c) => c.traditional === '貢丸湯')!;
    const ex = buildMeaningExercise(card, pool, mulberry32(1), { now })!;
    expect(ex).not.toBeNull();
    expect(ex.definition).toBe('Meatball soup');
    expect(ex.domain).toBe('food');
    expect(ex.options).toHaveLength(MEANING_OPTION_COUNT);
    expect(new Set(ex.options).size).toBe(MEANING_OPTION_COUNT);
    expect(ex.options).toContain('貢丸湯');
    expect(ex.answer).toBe('貢丸湯');
    expect(ex.foil).toBe('貞丸湯');
    expect(ex.options).toContain(ex.foil);
    // The written options never carry their reading, and the readable ones share the domain.
    expect(ex.options.every((o) => !containsPinyin(o))).toBe(true);
    for (const option of ex.options) {
      if (option === ex.answer || option === ex.foil) continue;
      expect(pool.find((c) => c.traditional === option)?.domain).toBe('food');
    }
    expect(ex.optionInfo['貢丸湯']).toEqual({
      pinyin: 'gòng wán tāng',
      definition: 'Meatball soup',
      spoken: undefined,
    });
    expect(ex.sentence?.traditional).toBe('我要一碗貢丸湯。');
  });

  it('asks by ear first with the readings of the same words, the target among them', () => {
    const card = pool.find((c) => c.traditional === '貢丸湯')!;
    const ex = buildMeaningExercise(card, pool, mulberry32(2), { now })!;
    expect(ex.readings).toHaveLength(MEANING_READING_COUNT);
    expect(ex.readings).toContain('gòng wán tāng');
    expect(ex.reading).toBe('gòng wán tāng');
    for (const reading of ex.readings) {
      if (reading === ex.reading) continue;
      const info = ex.readingInfo[reading];
      expect(info).toBeDefined();
      expect(info.traditional).not.toBe('貢丸湯');
    }
    // The as-heard reading is what the ear knows.
    const bahuan = pool.find((c) => c.traditional === '肉圓')!;
    const heard = buildMeaningExercise(bahuan, pool, mulberry32(3), { now })!;
    expect(heard.reading).toBe('bah-uân');
    expect(heard.readings).toContain('bah-uân');
  });

  it('skips the ear check when it is not due, and honours an explicit answer', () => {
    const card = {
      ...pool.find((c) => c.traditional === '貢丸湯')!,
      byEar: { at: ago(BY_EAR_RETRY_MS), known: true },
    };
    expect(buildMeaningExercise(card, pool, mulberry32(1), { now })!.readings).toEqual([]);
    expect(
      buildMeaningExercise(card, pool, mulberry32(1), { now, askByEar: true })!.readings,
    ).toHaveLength(MEANING_READING_COUNT);
    const unknown = { ...card, byEar: { at: ago(2 * BY_EAR_RETRY_MS), known: false } };
    expect(buildMeaningExercise(unknown, pool, mulberry32(1), { now })!.readings).toHaveLength(
      MEANING_READING_COUNT,
    );
  });

  it('never offers a near-synonym, in either step', () => {
    const rice = makeCard({ traditional: '米飯', pinyin: 'mǐ fàn', definition: 'Rice' });
    const plain = makeCard({
      traditional: '白飯',
      pinyin: 'bái fàn',
      definition: 'Plain steamed rice',
    });
    const all = [...pool, rice, plain];
    for (const seed of [1, 2, 3, 4, 5]) {
      const ex = buildMeaningExercise(rice, all, mulberry32(seed), { now })!;
      expect(ex.options).not.toContain('白飯');
      expect(ex.readings).not.toContain('bái fàn');
    }
  });

  it('leaves out the words it is told to avoid and returns null with nothing to offer', () => {
    const card = pool.find((c) => c.traditional === '貢丸湯')!;
    const avoid = new Set(['魚丸湯', '餛飩湯']);
    const ex = buildMeaningExercise(card, pool, mulberry32(1), { now, avoid })!;
    expect(ex.options).not.toContain('魚丸湯');
    expect(ex.options).not.toContain('餛飩湯');
    expect(ex.readings).not.toContain('yú wán tāng');
    expect(buildMeaningExercise(card, [card], mulberry32(1), { now })).toBeNull();
    expect(
      buildMeaningExercise({ ...card, definition: ' ' }, pool, mulberry32(1), { now }),
    ).toBeNull();
  });

  it('can be built for nearly every card of the shipped deck', async () => {
    const deck = await buildStarterDeck();
    let built = 0;
    let withEar = 0;
    for (const card of deck) {
      const ex = buildMeaningExercise(card, deck, mulberry32(11), { now });
      if (!ex) continue;
      built += 1;
      if (ex.readings.length > 0) withEar += 1;
      expect(ex.options).toContain(card.traditional);
      expect(ex.options.length).toBeGreaterThanOrEqual(3);
    }
    expect(built / deck.length).toBeGreaterThan(0.99);
    expect(withEar).toBe(built);
  }, 30_000);
});

describe('askByEar', () => {
  it('asks a word never checked, one known long ago, and one not known a day ago', () => {
    expect(askByEar({}, now)).toBe(true);
    expect(askByEar({ byEar: { at: ago(BY_EAR_RECHECK_MS - 1), known: true } }, now)).toBe(false);
    expect(askByEar({ byEar: { at: ago(BY_EAR_RECHECK_MS), known: true } }, now)).toBe(true);
    expect(askByEar({ byEar: { at: ago(BY_EAR_RETRY_MS - 1), known: false } }, now)).toBe(false);
    expect(askByEar({ byEar: { at: ago(BY_EAR_RETRY_MS), known: false } }, now)).toBe(true);
    expect(askByEar({ byEar: { at: 'nope', known: true } }, now)).toBe(true);
  });
});

describe('near-synonyms', () => {
  it('reads definitions as content words', () => {
    expect(contentWords('Braised minced pork over rice')).toEqual(
      new Set(['braised', 'minced', 'pork', 'over', 'rice']),
    );
    expect(contentWords('Wontons (small dumplings)')).toEqual(new Set(['wonton']));
    expect(contentWords('To snark / roast (tsukkomi)')).toEqual(new Set(['snark', 'roast']));
  });

  it('calls two definitions near when one is inside the other or they share two words', () => {
    expect(nearSynonyms('Rice', 'Plain steamed rice')).toBe(true);
    expect(nearSynonyms('Wontons', 'Wonton soup')).toBe(true);
    expect(nearSynonyms('Bubble milk tea', 'Bubble tea with big pearls')).toBe(true);
    expect(nearSynonyms('Wonton soup', 'Pork meatball soup')).toBe(false);
    expect(nearSynonyms('Awesome / impressive', 'Awesome; like (thumbs up)')).toBe(false);
    expect(nearSynonyms('', 'Rice')).toBe(false);
  });
});
