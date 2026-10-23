import { findSimplified, isSimplifiedOnly } from './simplifiedChars';

describe('simplified-only characters', () => {
  it('flags simplified forms and leaves traditional ones alone', () => {
    expect(isSimplifiedOnly('国')).toBe(true);
    expect(isSimplifiedOnly('们')).toBe(true);
    expect(isSimplifiedOnly('國')).toBe(false);
    expect(isSimplifiedOnly('你')).toBe(false);
  });

  it('treats a character outside the BMP as one character', () => {
    const rare = Array.from('𫛺')[0];
    expect(isSimplifiedOnly(rare)).toBe(true);
    expect(findSimplified(`a${rare}b`)).toEqual([rare]);
  });

  it('lists each simplified character once, in order of first appearance', () => {
    expect(findSimplified('我们的国国们')).toEqual(['们', '国']);
    expect(findSimplified('我們的國')).toEqual([]);
    expect(findSimplified('')).toEqual([]);
  });
});
