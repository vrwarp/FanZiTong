import { containsHan, containsPinyin, hanChars, numberedToMarks } from './pinyin';

describe('numberedToMarks', () => {
  it('converts tone numbers to diacritics with standard placement', () => {
    expect(numberedToMarks('lu3 rou4 fan4')).toBe('lǔ ròu fàn');
    expect(numberedToMarks('tuan2 qi4')).toBe('tuán qì');
    expect(numberedToMarks('xiao3 zu3')).toBe('xiǎo zǔ');
    expect(numberedToMarks('hao3 kan4')).toBe('hǎo kàn');
  });

  it('handles "ou", "iu", "ui" and ü', () => {
    expect(numberedToMarks('dou4')).toBe('dòu');
    expect(numberedToMarks('liu2')).toBe('liú');
    expect(numberedToMarks('gui1')).toBe('guī');
    expect(numberedToMarks('lv4')).toBe('lǜ');
    expect(numberedToMarks('nü3')).toBe('nǚ');
  });

  it('leaves neutral tones and already-marked text alone', () => {
    expect(numberedToMarks('ma5')).toBe('ma');
    expect(numberedToMarks('lǔ ròu fàn')).toBe('lǔ ròu fàn');
    expect(numberedToMarks('')).toBe('');
  });
});

describe('containsPinyin / containsHan', () => {
  it('detects tone marks and latin letters', () => {
    expect(containsPinyin('lǔ ròu fàn')).toBe(true);
    expect(containsPinyin('abc')).toBe(true);
    expect(containsPinyin('滷肉飯')).toBe(false);
    expect(containsPinyin('老闆，我要一碗。')).toBe(false);
  });

  it('detects Han characters and splits them', () => {
    expect(containsHan('滷肉飯')).toBe(true);
    expect(containsHan('abc')).toBe(false);
    expect(hanChars('滷肉飯 (S)')).toEqual(['滷', '肉', '飯']);
    expect(hanChars('滷肉飯 (小)')).toEqual(['滷', '肉', '飯', '小']);
  });
});
