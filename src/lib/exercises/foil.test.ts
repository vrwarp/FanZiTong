import { mulberry32 } from '@/lib/util/random';
import { makeCard, makePool } from '@/test/factories';
import { buildFoilExercise, expandFoil, FOIL_OPTION_COUNT, pickFoilOptions } from './foil';

describe('expandFoil', () => {
  it('substitutes single-character foils into the head position of a word', () => {
    expect(expandFoil('滷肉飯', '魯')).toBe('魯肉飯');
  });
  it('uses same-length foils verbatim and rejects identical or empty foils', () => {
    expect(expandFoil('團契', '團隊')).toBe('團隊');
    expect(expandFoil('滷', '魯')).toBe('魯');
    expect(expandFoil('滷肉飯', '滷')).toBeNull();
    expect(expandFoil('滷肉飯', '  ')).toBeNull();
    expect(expandFoil('滷肉飯', 'abc')).toBeNull();
  });
});

describe('buildFoilExercise', () => {
  const pool = makePool();

  it('includes the answer and expanded foils, with no duplicates', () => {
    const card = pool[0];
    const ex = buildFoilExercise(card, pool, mulberry32(5))!;
    expect(ex.options).toHaveLength(FOIL_OPTION_COUNT);
    expect(new Set(ex.options).size).toBe(FOIL_OPTION_COUNT);
    expect(ex.options).toContain('滷肉飯');
    expect(ex.options).toContain('魯肉飯');
    expect(ex.options).toContain('鹵肉飯');
    expect(ex.pinyin).toBe('lǔ ròu fàn');
    expect(ex.definition).toBe('Braised pork rice');
  });

  it('pads from the pool with same-length words first', () => {
    const card = makeCard({ traditional: '火鍋', visualFoils: [] });
    const options = pickFoilOptions(card, pool, 3, mulberry32(6));
    expect(options).toHaveLength(3);
    expect(options.every((o) => o.length === 2)).toBe(true);
  });

  it('returns null when no foil can be produced', () => {
    const card = makeCard({ visualFoils: [] });
    expect(buildFoilExercise(card, [card])).toBeNull();
  });
});
