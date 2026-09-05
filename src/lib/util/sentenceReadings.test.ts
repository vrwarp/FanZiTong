import { alignSentenceReadings, countSyllables } from './sentenceReadings';

describe('countSyllables', () => {
  it('counts pinyin syllables inside a word-segmented token', () => {
    expect(countSyllables('lǔròufàn')).toBe(3);
    expect(countSyllables('Lǎobǎn')).toBe(2);
    expect(countSyllables('yīyàng')).toBe(2);
    expect(countSyllables('Táiwān')).toBe(2);
    expect(countSyllables('niánqīngrén')).toBe(3);
    expect(countSyllables('jiǔcéngtǎ')).toBe(3);
    expect(countSyllables("gǎn'ēn")).toBe(2);
    expect(countSyllables('SSR')).toBe(0);
  });
});

describe('alignSentenceReadings', () => {
  it('maps each pinyin word onto its characters, skipping punctuation', () => {
    const words = alignSentenceReadings(
      '老闆，滷肉飯大碗一碗，加一顆滷蛋。',
      'Lǎobǎn, lǔròufàn dà wǎn yī wǎn, jiā yī kē lǔdàn.',
    )!;
    expect(words.map((w) => w.text)).toEqual([
      '老闆',
      '滷肉飯',
      '大',
      '碗',
      '一',
      '碗',
      '加',
      '一',
      '顆',
      '滷蛋',
    ]);
    expect(words[1]).toMatchObject({ start: 3, reading: 'lǔròufàn' });
  });

  it('returns null when the reading cannot be aligned', () => {
    expect(
      alignSentenceReadings(
        '這次抽卡又沒抽到 SSR，好想哭。',
        'Zhè cì chōukǎ yòu méi chōu dào SSR, hǎo xiǎng kū.',
      ),
    ).not.toBeNull();
    expect(alignSentenceReadings('老闆，滷肉飯', 'Lǎobǎn')).toBeNull();
    expect(alignSentenceReadings('老闆', '')).toBeNull();
  });
});

describe('countSyllables with an apostrophe', () => {
  it('treats the apostrophe as a syllable boundary', () => {
    expect(countSyllables("zuì'ài")).toBe(2);
    expect(countSyllables("Xī'ān")).toBe(2);
    expect(countSyllables("jīn'é")).toBe(2);
  });
});
