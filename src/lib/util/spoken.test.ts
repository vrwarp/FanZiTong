import { makeCard } from '@/test/factories';
import { readingOf, spokenCue } from './spoken';

describe('the reading the learner would hear', () => {
  const taiwanese = makeCard({ traditional: '蚵仔煎', pinyin: 'kē zǎi jiān', spoken: 'ô-á-tsian' });

  it('is the as-heard reading when the word is said that way', () => {
    expect(readingOf(taiwanese)).toBe('ô-á-tsian');
    expect(readingOf({ ...taiwanese, spokenUse: 'only' })).toBe('ô-á-tsian');
    expect(readingOf({ ...taiwanese, spokenUse: 'usual' })).toBe('ô-á-tsian');
    expect(readingOf({ ...taiwanese, spokenUse: 'either' })).toBe('ô-á-tsian');
  });

  it('is the pinyin when Mandarin is how the word is usually said, or there is no other', () => {
    const anime = makeCard({
      traditional: '動畫',
      pinyin: 'dòng huà',
      spoken: 'tōng-uē',
      spokenUse: 'also',
    });
    expect(readingOf(anime)).toBe('dòng huà');
    expect(spokenCue(anime)).toBeUndefined();
    expect(readingOf(makeCard())).toBe('lǔ ròu fàn');
    expect(spokenCue(makeCard({ spoken: '  ' }))).toBeUndefined();
  });
});
