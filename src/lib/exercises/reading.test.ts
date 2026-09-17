import { buildStarterDeck } from '@/data/starterDeck';
import { makeCard } from '@/test/factories';
import {
  buildTypedReadingExercise,
  markSyllables,
  normalizeReading,
  readingMatches,
  readingSyllables,
} from './reading';

describe('normalizeReading', () => {
  it('keeps the letters and drops tones, case, spacing and punctuation', () => {
    expect(normalizeReading('Lǔ ròu fàn')).toBe('luroufan');
    expect(normalizeReading('lu3 rou4 fan4')).toBe('luroufan');
    expect(normalizeReading('luroufan')).toBe('luroufan');
    expect(normalizeReading("xī'ān")).toBe('xian');
    expect(normalizeReading('Lǎobǎn,')).toBe('laoban');
  });

  it('reads ü as u, and v as the IME spelling of ü', () => {
    expect(normalizeReading('lǜ')).toBe('lu');
    expect(normalizeReading('nǚ')).toBe('nu');
    expect(normalizeReading('nv')).toBe('nu');
    expect(normalizeReading('lu:')).toBe('lu');
  });

  it('takes an as-heard reading the same way', () => {
    expect(normalizeReading('ô-á-tsian')).toBe('oatsian');
    expect(normalizeReading('m̄-thang')).toBe('mthang');
  });
});

describe('markSyllables', () => {
  const syllables = ['lǔ', 'ròu', 'fàn'];

  it('compares syllable by syllable when typed one per space', () => {
    expect(markSyllables('lu rou fan', syllables).map((m) => m.ok)).toEqual([true, true, true]);
    expect(markSyllables('lu ruo fan', syllables).map((m) => m.ok)).toEqual([true, false, true]);
    expect(markSyllables('lü rou fàn', syllables).map((m) => m.ok)).toEqual([true, true, true]);
  });

  it('consumes a run-together reading from the front and resyncs after a wrong syllable', () => {
    expect(markSyllables('luroufan', syllables).map((m) => m.ok)).toEqual([true, true, true]);
    expect(markSyllables('luruofan', syllables).map((m) => m.ok)).toEqual([true, false, true]);
    expect(markSyllables('lufan', syllables).map((m) => m.ok)).toEqual([true, false, true]);
    expect(markSyllables('xyz', syllables).map((m) => m.ok)).toEqual([false, false, false]);
  });

  it('names the syllables as the card spells them', () => {
    expect(markSyllables('lu rou fan', syllables).map((m) => m.syllable)).toEqual(syllables);
  });
});

describe('buildTypedReadingExercise', () => {
  it('asks for the reading of the characters and accepts it however it is typed', () => {
    const card = makeCard();
    const ex = buildTypedReadingExercise(card)!;
    expect(ex).toMatchObject({
      type: 'typed_reading',
      cardId: card.id,
      word: '滷肉飯',
      syllables: ['lǔ', 'ròu', 'fàn'],
      accepted: ['luroufan'],
      reading: 'lǔ ròu fàn',
      pinyin: 'lǔ ròu fàn',
    });
    expect(ex.sentence?.traditional).toBe(card.exampleSentenceTraditional);
    expect(readingMatches('Lu Rou Fan', ex.accepted)).toBe(true);
    expect(readingMatches('lu3rou4fan4', ex.accepted)).toBe(true);
    expect(readingMatches('lu rou fen', ex.accepted)).toBe(false);
    expect(readingMatches('  ', ex.accepted)).toBe(false);
  });

  it('accepts the as-heard reading too, and shows it first', () => {
    const card = makeCard({ traditional: '蚵仔煎', pinyin: 'kē zǎi jiān', spoken: 'ô-á-tsian' });
    const ex = buildTypedReadingExercise(card)!;
    expect(ex.accepted).toEqual(['kezaijian', 'oatsian']);
    expect(ex.reading).toBe('ô-á-tsian');
    expect(ex.pinyin).toBe('kē zǎi jiān');
    expect(readingMatches('o a tsian', ex.accepted)).toBe(true);
  });

  it('cuts a reading that is not one syllable per character by the syllable rule', () => {
    expect(readingSyllables({ traditional: '滷肉飯', pinyin: 'lǔ ròu fàn' })).toEqual([
      'lǔ',
      'ròu',
      'fàn',
    ]);
    // Run together, the syllable rule does its best; the letters are all kept.
    const run = readingSyllables({ traditional: '滷肉飯', pinyin: 'lǔròufàn' });
    expect(run.length).toBeGreaterThanOrEqual(2);
    expect(normalizeReading(run.join(''))).toBe('luroufan');
    expect(readingSyllables({ traditional: '兒', pinyin: 'ér' })).toEqual(['ér']);
  });

  it('is null without a reading', () => {
    expect(buildTypedReadingExercise(makeCard({ pinyin: ' ' }))).toBeNull();
    expect(buildTypedReadingExercise(makeCard({ traditional: 'OK', pinyin: 'ok' }))).toBeNull();
  });

  it('can be built for every card of the shipped deck', async () => {
    const deck = await buildStarterDeck();
    for (const card of deck) {
      const ex = buildTypedReadingExercise(card);
      expect(ex, card.traditional).not.toBeNull();
      expect(readingMatches(card.pinyin, ex!.accepted), card.traditional).toBe(true);
      expect(ex!.syllables.length, card.traditional).toBeGreaterThan(0);
    }
  }, 30_000);
});
