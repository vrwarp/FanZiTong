import { makeCard, reviewState } from '@/test/factories';
import { mulberry32 } from '@/lib/util/random';
import {
  coverageOf,
  knownCharacters,
  pickReadingSentences,
  scanText,
  sentenceCoverage,
  untestedCharacters,
} from './coverage';
import {
  READING_RUNS_LIMIT,
  charactersPerMinute,
  emptyReadingState,
  markCharacterKnown,
  mostTapped,
  parseReadingState,
  recordCharacterCheck,
  recordReadingRun,
} from './state';

const studied = (traditional: string, sentence: string, extra = {}) =>
  makeCard({
    traditional,
    fsrs: reviewState(),
    exampleSentenceTraditional: sentence,
    exampleSentencePinyin: 'pinyin',
    exampleSentenceTranslation: 'translation',
    extraSentences: [],
    ...extra,
  });

describe('reading coverage', () => {
  const cards = [
    studied('滷肉飯', '我要滷肉飯。'),
    studied('豆漿', '豆漿和滷肉飯。'),
    studied('蛋餅', '這個蛋餅很好吃的。'),
    makeCard({ traditional: '牛肉麵', exampleSentenceTraditional: '牛肉麵很好。' }),
  ];

  it('takes the characters of studied words as known, plus and minus what the learner marked', () => {
    const known = knownCharacters(cards);
    expect(known.has('滷')).toBe(true);
    expect(known.has('牛')).toBe(false); // never studied
    expect(known.has('我')).toBe(false); // in a sentence only
    expect(knownCharacters(cards, ['我'], ['滷']).has('我')).toBe(true);
    expect(knownCharacters(cards, ['我'], ['滷']).has('滷')).toBe(false);
    expect(coverageOf('我要滷肉飯。', known)).toBeCloseTo(3 / 5);
    expect(coverageOf('…', known)).toBe(1);
  });

  it('lists the common characters no studied word has tested, most frequent first', () => {
    const untested = untestedCharacters(cards);
    expect(
      untested
        .slice(0, 2)
        .map((u) => u.char)
        .sort(),
    ).toEqual(['好', '很'].sort());
    expect(untested[0].count).toBe(2);
    expect(untested.map((u) => u.char)).toEqual(expect.arrayContaining(['我', '要', '的', '這']));
    expect(untested.map((u) => u.char)).not.toContain('滷');
    // A character already answered in the check is not asked again.
    expect(untestedCharacters(cards, new Set(['很'])).map((u) => u.char)).not.toContain('很');
  });

  it('offers sentences made mostly of known characters, those with something new first', () => {
    const known = knownCharacters(cards, ['和', '我', '要']);
    const picked = pickReadingSentences(cards, known, { count: 5, rng: mulberry32(1) });
    // 蛋餅's sentence is under the line; the unstudied word's is never offered.
    expect(picked.map((s) => s.traditional).sort()).toEqual(['我要滷肉飯。', '豆漿和滷肉飯。']);
    expect(picked.every((s) => s.coverage === 1)).toBe(true);
    const loose = pickReadingSentences(cards, known, {
      count: 1,
      minCoverage: 0.2,
      rng: mulberry32(1),
    });
    expect(loose[0].traditional).toBe('這個蛋餅很好吃的。');
    expect(loose[0]).toMatchObject({ word: '蛋餅', pinyin: 'pinyin', translation: 'translation' });
    expect(
      pickReadingSentences(cards, known, { count: 5, avoid: new Set(['我要滷肉飯。']) }),
    ).toHaveLength(1);
    const aside = cards.map((c) => ({ ...c, setAsideAt: '2026-09-01T00:00:00.000Z' }));
    expect(pickReadingSentences(aside, known, { count: 5 })).toEqual([]);
    expect(sentenceCoverage(cards, knownCharacters(cards))).toBeCloseTo(10 / 19);
    expect(sentenceCoverage([cards[3]], known)).toBeNull();
  });

  it('finds the deck’s words in a pasted text, the longest at each place', () => {
    const deck = [
      studied('貢丸', '貢丸。'),
      makeCard({ traditional: '貢丸湯' }),
      makeCard({ traditional: '禱告', variants: ['祈禱'] }),
      makeCard({ traditional: '牧師' }),
    ];
    const scan = scanText('今天喝貢丸湯，吃貢丸，然後祈禱。Amen', deck);
    expect(scan.unseen.map((c) => c.traditional)).toEqual(['貢丸湯', '禱告']);
    expect(scan.studied.map((c) => c.traditional)).toEqual(['貢丸']);
    expect(scan.uncovered.map((u) => u.char)).toEqual(
      expect.arrayContaining(['今', '天', '喝', '吃', '然', '後']),
    );
    expect(scan.uncovered.map((u) => u.char)).not.toContain('A');
    expect(scan.characters).toBe(13);
    expect(scanText('', deck)).toMatchObject({ unseen: [], studied: [], characters: 0 });
  });
});

describe('reading state', () => {
  it('reads back what it wrote, and treats anything else as empty', () => {
    expect(parseReadingState(undefined)).toEqual(emptyReadingState());
    expect(parseReadingState('not json')).toEqual(emptyReadingState());
    expect(parseReadingState('null')).toEqual(emptyReadingState());
    expect(
      parseReadingState(
        JSON.stringify({
          known: ['的', 3],
          taps: { 這: 2, 了: 0 },
          runs: [{ at: 'x' }],
          recent: 'no',
        }),
      ),
    ).toEqual({ known: ['的'], unknown: [], taps: { 這: 2 }, runs: [], recent: [] });
    const run = {
      at: '2026-09-05T08:00:00.000Z',
      sentences: 2,
      characters: 20,
      tapped: 1,
      ms: 60_000,
    };
    const state = recordReadingRun(emptyReadingState(), run, ['甲。', '乙。'], ['這', '這', '了']);
    expect(parseReadingState(JSON.stringify(state))).toEqual(state);
    expect(state.taps).toEqual({ 這: 2, 了: 1 });
    expect(state.recent).toEqual(['甲。', '乙。']);
    expect(mostTapped(state)).toEqual([
      { char: '這', taps: 2 },
      { char: '了', taps: 1 },
    ]);
    expect(charactersPerMinute(state.runs)).toBe(20);
    expect(charactersPerMinute([])).toBeNull();
    let many = emptyReadingState();
    for (let i = 0; i < READING_RUNS_LIMIT + 5; i += 1) many = recordReadingRun(many, run, [], []);
    expect(many.runs).toHaveLength(READING_RUNS_LIMIT);
  });

  it('keeps what the common-character check found, and lets a character graduate', () => {
    let state = recordCharacterCheck(emptyReadingState(), ['的', '這', '了'], new Set(['這']));
    expect(state.known.sort()).toEqual(['了', '的'].sort());
    expect(state.unknown).toEqual(['這']);
    // Asked again later and read: it moves across.
    state = recordCharacterCheck(state, ['這', '的'], new Set(['的']));
    expect(state.unknown).toEqual(['的']);
    expect(state.known).toContain('這');
    state = markCharacterKnown(state, '的');
    expect(state.unknown).toEqual([]);
    expect(markCharacterKnown(state, '的').known.filter((c) => c === '的')).toHaveLength(1);
  });
});
