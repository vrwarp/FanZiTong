import { mulberry32 } from '@/lib/util/random';
import { containsPinyin } from '@/lib/util/pinyin';
import { makeCard, makePool } from '@/test/factories';
import { buildClozeExercise, CLOZE_OPTION_COUNT, pickClozeDistractors } from './cloze';

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

  it('prefers word-length visual foils as distractors', () => {
    const card = pool.find((c) => c.traditional === '團契')!;
    const distractors = pickClozeDistractors(card, pool, 3, mulberry32(2));
    expect(distractors.sort()).toEqual(['團夥', '團隊', '契合']);
  });

  it('keeps pinyin out of the prompt (AC-2) and only in feedback', () => {
    const card = pool[0];
    const ex = buildClozeExercise(card, pool, mulberry32(3))!;
    expect(containsPinyin(ex.before + ex.after)).toBe(false);
    expect(ex.options.every((o) => !containsPinyin(o))).toBe(true);
    expect(ex.sentencePinyin).toBe(card.exampleSentencePinyin);
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
