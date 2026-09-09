import { mulberry32 } from '@/lib/util/random';
import { makeCard, makePool } from '@/test/factories';
import {
  buildFoilExercise,
  centroidOption,
  diffCharacters,
  expandFoil,
  FOIL_MIN_OPTION_COUNT,
  FOIL_OPTION_COUNT,
  foilAxes,
  isSilhouetteGuessable,
  isVariantOf,
  pickFoilOptions,
  positionModeString,
} from './foil';

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

describe('foilAxes', () => {
  it('groups authored foils by the character position they replace', () => {
    const card = makeCard({ traditional: '滷肉飯', visualFoils: ['魯', '滷內飯'] });
    const axes = foilAxes(card, [card], 'shape');
    expect(axes.map((a) => a.index)).toEqual([0, 1]);
    expect(axes[0].candidates).toContain('魯');
    expect(axes[1].candidates).toContain('內');
  });

  it('derives same-reading candidates from the pool without any authored data', () => {
    const card = makeCard({ traditional: '豆漿', pinyin: 'dòu jiāng', visualFoils: [] });
    const pool = [
      card,
      makeCard({ traditional: '醬油', pinyin: 'jiàng yóu' }),
      makeCard({ traditional: '逗趣', pinyin: 'dòu qù' }),
    ];
    const axes = foilAxes(card, pool, 'homophone');
    expect(axes.find((a) => a.index === 0)?.candidates).toContain('逗');
    expect(axes.find((a) => a.index === 1)?.candidates).toContain('醬');
  });

  it('never proposes a swap that lands on a real word or an accepted variant', () => {
    const card = makeCard({ traditional: '滷肉飯', visualFoils: ['魯'], variants: ['魯肉飯'] });
    const axes = foilAxes(card, [card], 'shape');
    expect(axes.flatMap((a) => a.candidates)).not.toContain('魯');
  });
});

describe('buildFoilExercise', () => {
  const pool = makePool();

  it('builds a balanced set the answer cannot be counted out of', () => {
    const card = pool[0];
    const ex = buildFoilExercise(card, pool, mulberry32(5))!;
    expect(ex.options.length).toBeGreaterThanOrEqual(FOIL_MIN_OPTION_COUNT);
    expect(ex.options.length).toBeLessThanOrEqual(FOIL_OPTION_COUNT);
    expect(new Set(ex.options).size).toBe(ex.options.length);
    expect(ex.options).toContain(card.traditional);
    expect(ex.answer).toBe(card.traditional);
    expect(isSilhouetteGuessable(ex.options, ex.answer)).toBe(false);
  });

  it('crosses two positions so every glyph appears in half the options', () => {
    const card = makeCard({ traditional: '滷肉飯', visualFoils: ['魯', '滷內飯'] });
    const ex = buildFoilExercise(card, [card], mulberry32(2))!;
    expect(ex.strategy).toBe('factorial');
    expect(ex.options).toHaveLength(FOIL_OPTION_COUNT);
    expect(positionModeString(ex.options)).toBeNull();
    expect(centroidOption(ex.options)).toBeNull();
  });

  it('falls back to three balanced tiles rather than padding with a stranger', () => {
    const card = makeCard({ traditional: '火鍋', pinyin: 'huǒ guō', visualFoils: ['伙', '夥'] });
    const ex = buildFoilExercise(card, [card], mulberry32(6))!;
    expect(ex.options).toHaveLength(FOIL_MIN_OPTION_COUNT);
    expect(ex.strategy).toBe('pair');
    expect(isSilhouetteGuessable(ex.options, ex.answer)).toBe(false);
  });

  it('prefers the same-sound confusion over the same-shape one', () => {
    const card = makeCard({
      traditional: '豆漿',
      pinyin: 'dòu jiāng',
      visualFoils: ['荳', '豆槳'],
      homophoneFoils: ['逗', '豆醬'],
    });
    const ex = buildFoilExercise(card, [card], mulberry32(9))!;
    expect(ex.source).toBe('homophone');
    expect(ex.options.join('')).toContain('逗');
  });

  it('uses look-alike shapes when the card has no same-sound candidates', () => {
    const card = makeCard({ traditional: '牧師', pinyin: 'mù shī', visualFoils: ['收', '牧帥'] });
    const ex = buildFoilExercise(card, [card], mulberry32(4))!;
    expect(ex.source).toBe('shape');
  });

  it('returns null rather than an unanswerable set', () => {
    const card = makeCard({ traditional: '囍', pinyin: 'xǐ', visualFoils: [] });
    expect(buildFoilExercise(card, [card])).toBeNull();
  });

  it('never offers an accepted variant as a foil', () => {
    const card = makeCard({ visualFoils: ['魯', '鹵肉飯'], variants: ['魯肉飯', '鹵肉飯'] });
    const options = pickFoilOptions(card, pool, mulberry32(7));
    expect(options).not.toContain('魯肉飯');
    expect(options).not.toContain('鹵肉飯');
    expect(isVariantOf(card, '魯肉飯')).toBe(true);
  });

  it('diffs characters position by position', () => {
    expect(diffCharacters('滷內飯', '滷肉飯')).toEqual([{ index: 1, picked: '內', correct: '肉' }]);
    expect(diffCharacters('牧帥', '牧師')).toEqual([{ index: 1, picked: '帥', correct: '師' }]);
    expect(diffCharacters('魯', '滷肉飯')).toEqual([]);
  });
});

describe('positionModeString and centroidOption', () => {
  it('name the answer when three foils are edits of one word', () => {
    const star = ['吐槽', '土槽', '吐嘈', '吐曹'];
    expect(positionModeString(star)).toBe('吐槽');
    expect(centroidOption(star)).toBe('吐槽');
  });

  it('return null when the set is balanced', () => {
    expect(positionModeString(['吐槽', '土槽', '吐嘈', '土嘈'])).toBeNull();
    expect(centroidOption(['吐槽', '土槽', '吐嘈', '土嘈'])).toBeNull();
  });

  it('ignore option sets of mixed length, which have a different tell', () => {
    expect(positionModeString(['滷肉飯', '魯肉飯', '火鍋'])).toBeNull();
  });
});
