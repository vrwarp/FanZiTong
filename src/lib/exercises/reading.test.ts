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
    expect(ex.accepted).toEqual(['kezaijian']);
    expect(ex.acceptedSpoken).toEqual(['oatsian']);
    expect(ex.reading).toBe('ô-á-tsian');
    expect(ex.pinyin).toBe('kē zǎi jiān');
    expect(readingMatches('o a tsian', ex.accepted, ex.acceptedSpoken)).toBe(true);
    expect(readingMatches('o a tsian', ex.accepted)).toBe(false);
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
      if (card.spoken) {
        expect(
          readingMatches(card.spoken, ex!.accepted, ex!.acceptedSpoken),
          card.traditional,
        ).toBe(true);
      }
      expect(ex!.syllables.length, card.traditional).toBeGreaterThan(0);
    }
  }, 30_000);
});

describe('the pinyin as a Taiwanese accent spells it', () => {
  it('folds the mergers of Taiwanese Mandarin onto one key', async () => {
    const { accentKey } = await import('./reading');
    // -n / -ng
    expect(accentKey('hěn xiā')).toBe(accentKey('heng xia'));
    expect(accentKey('fǎn pài')).toBe(accentKey('fang pai'));
    expect(accentKey('guān kǎ')).toBe(accentKey('guang ka'));
    expect(accentKey('xīn')).toBe(accentKey('xing'));
    // retroflex / alveolar
    expect(accentKey('zhuā pá zǐ')).toBe(accentKey('zhua pa zhi'));
    expect(accentKey('shān')).toBe(accentKey('san'));
    expect(accentKey('zhì yù xì')).toBe(accentKey('zi yu xi'));
    // f said as hu-, and eng after a labial said as ong
    expect(accentKey('fàn')).toBe(accentKey('huan'));
    expect(accentKey('fú')).toBe(accentKey('hu'));
    expect(accentKey('fēi')).toBe(accentKey('hui'));
    expect(accentKey('fēng')).toBe(accentKey('fong'));
    expect(accentKey('fēng')).toBe(accentKey('hong'));
    expect(accentKey('mèng')).toBe(accentKey('mong'));
    // What it does not fold: a different vowel, a different initial class, or
    // aspiration (總 zǒng typed "cong" is a romanisation slip, not an accent).
    expect(accentKey('lǔ ròu fàn')).not.toBe(accentKey('lu ruo fan'));
    expect(accentKey('shǎ yǎn')).not.toBe(accentKey('xia yan'));
    expect(accentKey('zhì yù xì')).not.toBe(accentKey('shi yu xi'));
    expect(accentKey('zǒng pù shī')).not.toBe(accentKey('cong pu shi'));
  });

  it('is a reading, told apart from the standard spelling only to name it', async () => {
    const { buildTypedReadingExercise, matchReading, readingMatches } = await import('./reading');
    const ex = buildTypedReadingExercise(
      makeCard({ traditional: '很瞎', pinyin: 'hěn xiā', definition: 'absurd' }),
    )!;
    expect(ex.acceptedAccent).toEqual(['henxia']);
    expect(matchReading('hen xia', ex)).toBe('pinyin');
    expect(matchReading('heng xia', ex)).toBe('accent');
    expect(matchReading('hengxia', ex)).toBe('accent');
    expect(matchReading('he xia', ex)).toBeNull();
    // The strict check is unchanged: the accent spelling is not the standard one.
    expect(readingMatches('heng xia', ex.accepted, ex.acceptedSpoken)).toBe(false);

    const taiwanese = buildTypedReadingExercise(
      makeCard({ traditional: '總鋪師', pinyin: 'zǒng pù shī', spoken: 'tsóng-phòo-sai' }),
    )!;
    expect(matchReading('tsong phoo sai', taiwanese)).toBe('spoken');
    expect(matchReading('zong pu si', taiwanese)).toBe('accent');
    // An aspiration slip, or half Mandarin and half Taiwanese, is neither reading.
    expect(matchReading('cong pu shi', taiwanese)).toBeNull();
    expect(matchReading('cong pu sai', taiwanese)).toBeNull();
  });
});

describe('a Taiwanese reading, however it is spelled', () => {
  it('takes Tâi-lô and POJ to one key', async () => {
    const { taiwaneseKey } = await import('./reading');
    expect(taiwaneseKey('ô-á-tsian')).toBe('oatsian');
    expect(taiwaneseKey('o a chian')).toBe('oatsian');
    expect(taiwaneseKey('oa5 tsian1')).toBe('oatsian');
    expect(taiwaneseKey('ua tsian')).toBe('oatsian');
    expect(taiwaneseKey('oatsian')).toBe('oatsian');
    expect(taiwaneseKey('tsuann-kiu')).toBe(taiwaneseKey('tsuannkiu'));
    expect(taiwaneseKey('sing')).toBe(taiwaneseKey('seng'));
    expect(taiwaneseKey('chhài')).toBe('tshai');
    expect(taiwaneseKey('phiat-pōo')).toBe('phiatpo');
    expect(taiwaneseKey('phiat-po͘')).toBe('phiatpo');
    expect(taiwaneseKey('tsuann')).toBe('tsoa');
    expect(taiwaneseKey('tsuaⁿ')).toBe('tsoa');
    expect(taiwaneseKey('m̄-thang')).toBe('mthang');
  });

  it('accepts the word typed in pinyin, Tâi-lô or POJ, and marks against the closer reading', async () => {
    const { buildTypedReadingExercise, markReading, readingMatches } = await import('./reading');
    const card = makeCard({ traditional: '蚵仔煎', pinyin: 'kē zǎi jiān', spoken: 'ô-á-tsian' });
    const ex = buildTypedReadingExercise(card)!;
    expect(ex.accepted).toEqual(['kezaijian']);
    expect(ex.spoken).toBe('ô-á-tsian');
    expect(ex.spokenSyllables).toEqual(['ô', 'á', 'tsian']);
    expect(ex.acceptedSpoken).toEqual(['oatsian']);
    for (const typed of ['ke zai jian', 'ô-á-tsian', 'o a tsian', 'o a chian', 'oatsian']) {
      expect(readingMatches(typed, ex.accepted, ex.acceptedSpoken), typed).toBe(true);
    }
    expect(readingMatches('o a tsien', ex.accepted, ex.acceptedSpoken)).toBe(false);
    // A near miss in Taiwanese is marked against the Taiwanese syllables…
    const taiwanese = markReading('o a tsien', ex);
    expect(taiwanese.against).toBe('spoken');
    expect(taiwanese.marks.map((m) => m.ok)).toEqual([true, true, false]);
    // …and one in pinyin against the pinyin.
    const pinyin = markReading('ke zai jien', ex);
    expect(pinyin.against).toBe('pinyin');
    expect(pinyin.marks.map((m) => m.ok)).toEqual([true, true, false]);
  });

  it('leaves a word with no as-heard reading to its pinyin', async () => {
    const { buildTypedReadingExercise, markReading } = await import('./reading');
    const ex = buildTypedReadingExercise(makeCard())!;
    expect(ex.spoken).toBeUndefined();
    expect(ex.acceptedSpoken).toEqual([]);
    expect(markReading('lu ruo fan', ex).against).toBe('pinyin');
  });
});
