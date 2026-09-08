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

describe('a reading that starts with a tone mark', () => {
  // A sentence reading is written as a sentence, so a word whose first
  // syllable carries a tone mark starts with a capital that carries it too.
  // Those letters were being stripped as punctuation, which cost the syllable
  // and made the whole sentence fail to line up.
  it('counts the first syllable of Āmà, Èrshí and Ōu', () => {
    expect(countSyllables('Āmà')).toBe(2);
    expect(countSyllables('Èrshí')).toBe(2);
    expect(countSyllables('Ōu')).toBe(1);
  });

  it('aligns a sentence whose first word is tone-marked', () => {
    const words = alignSentenceReadings('阿嬤煮菜有很多撇步。', 'Āmà zhǔ cài yǒu hěn duō piēbù.');
    expect(words).not.toBeNull();
    expect(words![0]).toMatchObject({ text: '阿嬤', reading: 'Āmà' });
  });
});
