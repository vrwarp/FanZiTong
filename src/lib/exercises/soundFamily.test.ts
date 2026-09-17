import { loadEtymologyTable } from '@/lib/etymology';
import { mulberry32 } from '@/lib/util/random';
import { buildStarterDeck } from '@/data/starterDeck';
import { makeCard, reviewState } from '@/test/factories';
import {
  buildSoundFamilyExercise,
  hasSoundFamily,
  indexFromFamilies,
  maskCharacter,
  SOUND_FAMILY_MIN_SIBLINGS,
  soundFamilyChoices,
  soundFamilyIndex,
} from './soundFamily';

beforeAll(() => loadEtymologyTable());

/** A deck with one big family (青), one of three (反), and a pair (將) that is too small. */
function familyPool() {
  const word = (traditional: string, pinyin: string, definition: string) =>
    makeCard({ traditional, pinyin, definition, domain: 'food', visualFoils: [] });
  return [
    makeCard(), // 滷肉飯
    word('清湯', 'qīng tāng', 'Clear broth'),
    word('精華', 'jīng huá', 'Essence'),
    word('眼睛', 'yǎn jīng', 'Eyes'),
    word('心情', 'xīn qíng', 'Mood'),
    word('請問', 'qǐng wèn', 'Excuse me'),
    word('板主', 'bǎn zhǔ', 'Board moderator'),
    word('版本', 'bǎn běn', 'Version'),
    word('豆漿', 'dòu jiāng', 'Soy milk'),
    word('沙茶醬', 'shā chá jiàng', 'Shacha sauce'),
  ];
}

describe('soundFamilyIndex', () => {
  it('groups the deck’s characters by the part that gives them their reading', () => {
    const index = soundFamilyIndex(familyPool());
    expect(index.families.get('青')).toEqual(['情', '清', '睛', '精', '請']);
    expect(index.families.get('反')).toEqual(['板', '版', '飯']);
    expect(index.families.get('將')).toEqual(['漿', '醬']);
    expect(index.stemOf.get('飯')).toBe('反');
    expect(index.stemOf.get('滷')).toBe('鹵');
    // Written out by hand, the same shape.
    expect(indexFromFamilies({ 反: ['飯', '板', '版'] }).stemOf.get('板')).toBe('反');
  });
});

describe('soundFamilyChoices', () => {
  it('asks only about characters with enough deck siblings', () => {
    const pool = familyPool();
    const index = soundFamilyIndex(pool);
    expect(soundFamilyChoices(pool[0], index)).toEqual([
      { index: 2, char: '飯', stem: '反', siblings: ['板', '版'] },
    ]);
    expect(SOUND_FAMILY_MIN_SIBLINGS).toBe(2);
    // 漿 has one sibling: a two-tile drill is a coin toss, so none is asked.
    expect(
      hasSoundFamily(
        pool.find((c) => c.traditional === '豆漿')!,
        index,
      ),
    ).toBe(false);
    expect(
      hasSoundFamily(
        pool.find((c) => c.traditional === '清湯')!,
        index,
      ),
    ).toBe(true);
    expect(hasSoundFamily(makeCard({ traditional: '滷味' }), index)).toBe(false);
  });
});

describe('buildSoundFamilyExercise', () => {
  it('blanks the character and offers it among its family, with the meaning parts named', () => {
    const pool = familyPool();
    const index = soundFamilyIndex(pool);
    const ex = buildSoundFamilyExercise(pool[0], pool, index, mulberry32(1))!;
    expect(ex).toMatchObject({
      type: 'sound_family',
      cardId: pool[0].id,
      word: '滷肉飯',
      index: 2,
      masked: '滷肉＿',
      pinyin: 'lǔ ròu fàn',
      stem: '反',
      answer: '飯',
    });
    expect([...ex.options].sort()).toEqual(['板', '版', '飯']);
    expect(ex.memberInfo['飯']).toMatchObject({ char: '飯', reading: 'fàn', word: '滷肉飯' });
    expect(ex.memberInfo['飯'].meaningPart).toBe('飠');
    expect(ex.memberInfo['板'].meaningPart).toBe('木');
    expect(ex.memberInfo['板'].word).toBe('板主');
  });

  it('offers at most four tiles from a large family, the answer among them', () => {
    const pool = familyPool();
    const index = soundFamilyIndex(pool);
    const card = pool.find((c) => c.traditional === '清湯')!;
    const ex = buildSoundFamilyExercise(card, pool, index, mulberry32(2))!;
    expect(ex.masked).toBe('＿湯');
    expect(ex.options).toHaveLength(4);
    expect(new Set(ex.options).size).toBe(4);
    expect(ex.options).toContain('清');
    for (const option of ex.options) expect(['清', '精', '睛', '情', '請']).toContain(option);
    expect(ex.stem).toBe('青');
    expect(ex.stemReading).toBe('qīng');
    expect(ex.match).toBe('exact');
  });

  it('names a studied word for a sibling before an unstudied one', () => {
    const pool = familyPool();
    const studied = pool.map((c) => (c.traditional === '版本' ? { ...c, fsrs: reviewState() } : c));
    const index = soundFamilyIndex(studied);
    const ex = buildSoundFamilyExercise(studied[0], studied, index, mulberry32(1))!;
    expect(ex.memberInfo['版'].word).toBe('版本');
  });

  it('masks the n-th Han character and leaves the rest alone', () => {
    expect(maskCharacter('滷肉飯', 0)).toBe('＿肉飯');
    expect(maskCharacter('滷肉飯', 2)).toBe('滷肉＿');
    expect(maskCharacter('3D電影', 1)).toBe('3D電＿');
  });

  it('is null for a word with no family in the deck', () => {
    const pool = familyPool();
    const index = soundFamilyIndex(pool);
    expect(buildSoundFamilyExercise(makeCard({ traditional: '滷味' }), pool, index)).toBeNull();
  });

  it('reaches a good share of the shipped deck', async () => {
    const deck = await buildStarterDeck();
    const index = soundFamilyIndex(deck);
    let built = 0;
    for (const card of deck) {
      const ex = buildSoundFamilyExercise(card, deck, index, mulberry32(7));
      if (!ex) continue;
      built += 1;
      expect(ex.options.length).toBeGreaterThanOrEqual(3);
      expect(ex.options).toContain(ex.answer);
      expect(ex.masked).toContain('＿');
    }
    expect(built).toBeGreaterThan(200);
  }, 60_000);
});
