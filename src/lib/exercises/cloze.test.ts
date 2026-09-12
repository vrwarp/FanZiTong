import { mulberry32 } from '@/lib/util/random';
import { containsPinyin } from '@/lib/util/pinyin';
import { buildStarterDeck } from '@/data/starterDeck';
import { makeCard, makePool } from '@/test/factories';
import { buildClozeExercise, clozeBlank, CLOZE_OPTION_COUNT, pickClozeDistractors } from './cloze';

describe('buildClozeExercise', () => {
  const pool = makePool();

  it('blanks the target word and offers four unique options including the answer', () => {
    const card = pool.find((c) => c.traditional === '團契')!;
    const ex = buildClozeExercise(card, pool, mulberry32(1))!;
    expect(ex).not.toBeNull();
    expect(ex.before + ex.after).toBe('我們教會每週五晚上有青年。');
    expect(ex.before).not.toContain('團契');
    expect(ex.options).toHaveLength(CLOZE_OPTION_COUNT);
    expect(new Set(ex.options).size).toBe(CLOZE_OPTION_COUNT);
    expect(ex.options).toContain('團契');
    expect(ex.answer).toBe('團契');
  });

  it('uses readable words from the SAME domain plus one misspelling, never a variant', () => {
    const card = pool.find((c) => c.traditional === '團契')!;
    const { words, foil } = pickClozeDistractors(card, pool, 3, mulberry32(2));
    expect(words).toHaveLength(2);
    const byWord = new Map(pool.map((c) => [c.traditional, c]));
    for (const word of words) expect(byWord.has(word)).toBe(true);
    expect(['團隊', '契合', '團夥']).toContain(foil);
    // Other-domain distractors let "pick the one about church" beat reading the
    // sentence, so the answer's own domain is drained before anything else is
    // touched. This pool holds exactly one other church word, so it must appear
    // and the remaining slot may fall back.
    expect(words).toContain('禱告');
    const withVariant = { ...card, variants: ['團隊'] };
    const again = pickClozeDistractors(withVariant, pool, 3, mulberry32(2));
    expect(again.foil).not.toBe('團隊');
    expect(again.words).not.toContain('團隊');
  });

  it('prefers authored distractors and never uses a word that is already in the sentence', () => {
    const card = pool.find((c) => c.traditional === '團契')!;
    const authored = { ...card, clozeDistractors: ['聖經', '奉獻'] };
    const { words } = pickClozeDistractors(authored, pool, 3, mulberry32(3));
    expect(words).toContain('聖經');
    expect(words).toContain('奉獻');
    const rice = pool[0]; // sentence: 老闆，我要一碗滷肉飯。
    const withSentenceWord = [
      ...pool,
      makeCard({ traditional: '老闆', domain: 'slang', pinyin: 'lǎo bǎn', definition: 'boss' }),
    ];
    expect(pickClozeDistractors(rice, withSentenceWord, 3, mulberry32(4)).words).not.toContain(
      '老闆',
    );
  });

  it('names its foil explicitly and keeps readable distractors in the answer’s domain', async () => {
    const deck = await buildStarterDeck();
    const byWord = new Map(deck.map((c) => [c.traditional, c]));
    let checked = 0;
    let sameDomain = 0;
    for (const card of deck) {
      const ex = buildClozeExercise(card, deck, mulberry32(7));
      if (!ex) continue;
      if (ex.foil) expect(ex.options).toContain(ex.foil);
      for (const option of ex.options) {
        if (option === ex.answer || option === ex.foil) continue;
        const authored = card.clozeDistractors?.includes(option) ?? false;
        const word = byWord.get(option);
        expect(authored || word !== undefined).toBe(true);
        if (authored || !word) continue;
        checked += 1;
        if (word.domain === card.domain) sameDomain += 1;
      }
    }
    // A handful of small domains cannot fill three slots on their own, so the
    // rule is overwhelming rather than absolute.
    expect(checked).toBeGreaterThan(100);
    expect(sameDomain / checked).toBeGreaterThan(0.95);
  });

  it('carries pinyin and gloss for deck-word options', () => {
    const card = pool.find((c) => c.traditional === '團契')!;
    const ex = buildClozeExercise(card, pool, mulberry32(5))!;
    expect(ex.optionInfo['團契']).toEqual({ pinyin: 'tuán qì', definition: 'Fellowship' });
    expect(Object.keys(ex.optionInfo).length).toBeGreaterThanOrEqual(3);
    expect(clozeBlank('滷肉飯')).toBe('＿＿＿');
  });

  it('keeps pinyin out of the prompt (AC-2) and only in feedback', () => {
    const card = pool[0];
    const ex = buildClozeExercise(card, pool, mulberry32(3))!;
    expect(containsPinyin(ex.before + ex.after)).toBe(false);
    expect(ex.options.every((o) => !containsPinyin(o))).toBe(true);
    expect(ex.sentencePinyin).toBe(card.exampleSentencePinyin);
  });

  it('leaves out the words it is told to avoid', () => {
    const card = pool.find((c) => c.traditional === '團契')!;
    const avoid = new Set(['禱告']);
    const { words } = pickClozeDistractors(card, pool, 3, mulberry32(2), avoid);
    expect(words).not.toContain('禱告');
    const ex = buildClozeExercise(card, pool, mulberry32(1), { avoid })!;
    expect(ex.options).not.toContain('禱告');
    expect(ex.options).toContain('團契');
  });

  it('returns null when the sentence does not contain the word', () => {
    const card = makeCard({ exampleSentenceTraditional: '這句沒有目標。' });
    expect(buildClozeExercise(card, pool)).toBeNull();
  });

  it('falls back to other cards when foils are missing, never duplicating the answer', () => {
    const card = makeCard({
      traditional: '火鍋',
      exampleSentenceTraditional: '冬天吃火鍋。',
      visualFoils: [],
    });
    const ex = buildClozeExercise(card, [card, ...pool], mulberry32(4))!;
    expect(ex.options.filter((o) => o === '火鍋')).toHaveLength(1);
    expect(ex.options.length).toBeGreaterThanOrEqual(2);
  });

  it('returns null when there is nothing to use as a distractor', () => {
    const card = makeCard({ visualFoils: [] });
    expect(buildClozeExercise(card, [card])).toBeNull();
  });
});
