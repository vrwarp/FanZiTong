import { formatExtraSentenceLines, parseExtraSentenceLines } from './extraSentenceLines';

describe('extra sentences in the editor', () => {
  it('reads one sentence per line, with or without its reading and translation', () => {
    const text =
      '這家的滷肉飯不油。 | Zhe4 jia1 de lu3rou4fan4 bu4 you2. | Not greasy here.\n' +
      '\n' +
      '再一碗滷肉飯。\n' +
      ' | only a reading |\n';
    expect(parseExtraSentenceLines(text)).toEqual([
      {
        traditional: '這家的滷肉飯不油。',
        pinyin: 'Zhè jiā de lǔròufàn bù yóu.',
        translation: 'Not greasy here.',
      },
      { traditional: '再一碗滷肉飯。' },
    ]);
  });

  it('round-trips through the editor text', () => {
    const sentences = [
      {
        traditional: '這家的滷肉飯不油。',
        pinyin: 'Zhè jiā de lǔròufàn bù yóu.',
        translation: 'x',
      },
      { traditional: '再一碗滷肉飯。' },
    ];
    const text = formatExtraSentenceLines(sentences);
    expect(text).toBe('這家的滷肉飯不油。 | Zhè jiā de lǔròufàn bù yóu. | x\n再一碗滷肉飯。 |  | ');
    expect(parseExtraSentenceLines(text)).toEqual(sentences);
    expect(formatExtraSentenceLines(undefined)).toBe('');
  });
});
