import { mulberry32 } from '@/lib/util/random';
import { containsPinyin } from '@/lib/util/pinyin';
import { buildStarterDeck } from '@/data/starterDeck';
import { makeCard, makePool, reviewState } from '@/test/factories';
import {
  borrowedSentences,
  buildClozeExercise,
  chooseSentence,
  clozeBlank,
  CLOZE_BLANK_WIDTH,
  CLOZE_OPTION_COUNT,
  noteSentenceShown,
  ownSentences,
  pickClozeDistractors,
  SENTENCES_SHOWN_LIMIT,
} from './cloze';

describe('buildClozeExercise', () => {
  const pool = makePool();

  it('blanks the target word and offers four unique options including the answer', () => {
    const card = pool.find((c) => c.traditional === '團契')!;
    const ex = buildClozeExercise(card, pool, mulberry32(1))!;
    expect(ex).not.toBeNull();
    expect(ex.before + ex.after).toBe('我們教會每週五晚上有青年。');
    expect(ex.before).not.toContain('團契');
    expect(ex.options).toHaveLength(CLOZE_OPTION_COUNT);
    expect(new Set(ex.options).size).toBe(CLOZE_OPTION_COUNT);
    expect(ex.options).toContain('團契');
    expect(ex.answer).toBe('團契');
  });

  it('uses readable words from the SAME domain plus one misspelling, never a variant', () => {
    const card = pool.find((c) => c.traditional === '團契')!;
    const { words, foil } = pickClozeDistractors(card, pool, 3, mulberry32(2));
    expect(words).toHaveLength(2);
    const byWord = new Map(pool.map((c) => [c.traditional, c]));
    for (const word of words) expect(byWord.has(word)).toBe(true);
    expect(['團隊', '契合', '團夥']).toContain(foil);
    // Other-domain distractors let "pick the one about church" beat reading the
    // sentence, so the answer's own domain is drained before anything else is
    // touched. This pool holds exactly one other church word, so it must appear
    // and the remaining slot may fall back.
    expect(words).toContain('禱告');
    const withVariant = { ...card, variants: ['團隊'] };
    const again = pickClozeDistractors(withVariant, pool, 3, mulberry32(2));
    expect(again.foil).not.toBe('團隊');
    expect(again.words).not.toContain('團隊');
  });

  it('prefers authored distractors and never uses a word that is already in the sentence', () => {
    const card = pool.find((c) => c.traditional === '團契')!;
    const authored = { ...card, clozeDistractors: ['聖經', '奉獻'] };
    const { words } = pickClozeDistractors(authored, pool, 3, mulberry32(3));
    expect(words).toContain('聖經');
    expect(words).toContain('奉獻');
    const rice = pool[0]; // sentence: 老闆，我要一碗滷肉飯。
    const withSentenceWord = [
      ...pool,
      makeCard({ traditional: '老闆', domain: 'slang', pinyin: 'lǎo bǎn', definition: 'boss' }),
    ];
    expect(pickClozeDistractors(rice, withSentenceWord, 3, mulberry32(4)).words).not.toContain(
      '老闆',
    );
  });

  it('names its foil explicitly and keeps readable distractors in the answer’s domain', async () => {
    const deck = await buildStarterDeck();
    const byWord = new Map(deck.map((c) => [c.traditional, c]));
    let checked = 0;
    let sameDomain = 0;
    for (const card of deck) {
      const ex = buildClozeExercise(card, deck, mulberry32(7));
      if (!ex) continue;
      if (ex.foil) expect(ex.options).toContain(ex.foil);
      for (const option of ex.options) {
        if (option === ex.answer || option === ex.foil) continue;
        const authored = card.clozeDistractors?.includes(option) ?? false;
        const word = byWord.get(option);
        expect(authored || word !== undefined).toBe(true);
        if (authored || !word) continue;
        checked += 1;
        if (word.domain === card.domain) sameDomain += 1;
      }
    }
    // A handful of small domains cannot fill three slots on their own, so the
    // rule is overwhelming rather than absolute.
    expect(checked).toBeGreaterThan(100);
    expect(sameDomain / checked).toBeGreaterThan(0.95);
  });

  it('carries pinyin and gloss for deck-word options', () => {
    const card = pool.find((c) => c.traditional === '團契')!;
    const ex = buildClozeExercise(card, pool, mulberry32(5))!;
    expect(ex.optionInfo['團契']).toEqual({ pinyin: 'tuán qì', definition: 'Fellowship' });
    expect(Object.keys(ex.optionInfo).length).toBeGreaterThanOrEqual(3);
    expect(clozeBlank()).toBe('＿＿＿');
  });

  it('keeps pinyin out of the prompt (AC-2) and only in feedback', () => {
    const card = pool[0];
    const ex = buildClozeExercise(card, pool, mulberry32(3))!;
    expect(containsPinyin(ex.before + ex.after)).toBe(false);
    expect(ex.options.every((o) => !containsPinyin(o))).toBe(true);
    expect(ex.sentencePinyin).toBe(card.exampleSentencePinyin);
  });

  it('leaves out the words it is told to avoid', () => {
    const card = pool.find((c) => c.traditional === '團契')!;
    const avoid = new Set(['禱告']);
    const { words } = pickClozeDistractors(card, pool, 3, mulberry32(2), avoid);
    expect(words).not.toContain('禱告');
    const ex = buildClozeExercise(card, pool, mulberry32(1), { avoid })!;
    expect(ex.options).not.toContain('禱告');
    expect(ex.options).toContain('團契');
  });

  it('returns null when the sentence does not contain the word', () => {
    const card = makeCard({ exampleSentenceTraditional: '這句沒有目標。' });
    expect(buildClozeExercise(card, pool)).toBeNull();
  });

  it('falls back to other cards when foils are missing, never duplicating the answer', () => {
    const card = makeCard({
      traditional: '火鍋',
      exampleSentenceTraditional: '冬天吃火鍋。',
      visualFoils: [],
    });
    const ex = buildClozeExercise(card, [card, ...pool], mulberry32(4))!;
    expect(ex.options.filter((o) => o === '火鍋')).toHaveLength(1);
    expect(ex.options.length).toBeGreaterThanOrEqual(2);
  });

  it('returns null when there is nothing to use as a distractor', () => {
    const card = makeCard({ visualFoils: [] });
    expect(buildClozeExercise(card, [card])).toBeNull();
  });
});

describe('sentences a word can be shown in', () => {
  const day = 24 * 60 * 60_000;
  const now = new Date('2026-09-12T08:00:00.000Z');
  const ago = (days: number) => new Date(now.getTime() - days * day).toISOString();
  const wontons = () =>
    makeCard({
      traditional: '餛飩',
      pinyin: 'hún tun',
      definition: 'Wontons',
      exampleSentenceTraditional: '這家的餛飩皮很薄。',
      exampleSentencePinyin: 'Zhè jiā de húntun pí hěn báo.',
      exampleSentenceTranslation: 'This shop’s wontons have thin skins.',
      extraSentences: [
        {
          traditional: '我想吃餛飩。',
          pinyin: 'Wǒ xiǎng chī húntun.',
          translation: 'I want wontons.',
        },
        { traditional: '這句沒有那個詞。', translation: 'No target here.' },
        { traditional: '這家的餛飩皮很薄。' },
      ],
    });

  it('lists the card’s own sentences that contain the word, primary first, once each', () => {
    const own = ownSentences(wontons());
    expect(own.map((s) => s.traditional)).toEqual(['這家的餛飩皮很薄。', '我想吃餛飩。']);
    expect(own[0]).toMatchObject({ pinyin: 'Zhè jiā de húntun pí hěn báo.', own: true });
    expect(own[1].hostCardId).toBe(own[0].hostCardId);
  });

  it('borrows other cards’ sentences, met hosts first, never inside a longer word', () => {
    const card = wontons();
    const soup = makeCard({
      traditional: '餛飩湯',
      pinyin: 'hún tun tāng',
      exampleSentenceTraditional: '乾麵配餛飩湯是經典組合。',
      exampleSentencePinyin: 'Gānmiàn pèi húntuntāng shì jīngdiǎn zǔhé.',
      exampleSentenceTranslation: 'Dry noodles with wonton soup is the classic combo.',
    });
    const newHost = makeCard({
      traditional: '皮',
      pinyin: 'pí',
      exampleSentenceTraditional: '餛飩的皮要薄。',
      exampleSentencePinyin: 'Húntun de pí yào báo.',
    });
    const metHost = makeCard({
      traditional: '包',
      pinyin: 'bāo',
      fsrs: reviewState({ stability: 12 }),
      exampleSentenceTraditional: '阿嬤在包餛飩。',
      extraSentences: [
        { traditional: '包餛飩要有耐心。', translation: 'Wrapping takes patience.' },
      ],
    });
    const pool = [card, soup, newHost, metHost];
    const borrowed = borrowedSentences(card, pool);
    // 餛飩 inside 餛飩湯 is not a sighting of 餛飩, so the soup sentence stays out.
    expect(borrowed.map((s) => s.traditional)).toEqual([
      '阿嬤在包餛飩。',
      '包餛飩要有耐心。',
      '餛飩的皮要薄。',
    ]);
    expect(borrowed[0]).toMatchObject({ hostCardId: metHost.id, own: false });
    expect(borrowed[2].pinyin).toBe('Húntun de pí yào báo.');
    // A single character is more often part of another word than the word
    // itself, so 皮 borrows nothing even though 餛飩皮 is not a deck word.
    expect(borrowedSentences(newHost, pool)).toEqual([]);
    // The soup, in turn, may borrow the noodle sentence: 餛飩湯 stands on its own there.
    const noodles = makeCard({
      traditional: '乾麵',
      exampleSentenceTraditional: '乾麵配餛飩湯，剛剛好。',
    });
    expect(borrowedSentences(soup, [...pool, noodles]).map((s) => s.traditional)).toEqual([
      '乾麵配餛飩湯，剛剛好。',
    ]);
  });

  it('rotates the reveal through every sentence, least recently shown first', () => {
    let card = wontons();
    const pool = [card];
    const first = chooseSentence(card, pool, now, 'reveal')!;
    expect(first.traditional).toBe('這家的餛飩皮很薄。');
    card = noteSentenceShown(card, first.traditional, ago(2), 'reveal');
    const second = chooseSentence(card, pool, now, 'reveal')!;
    expect(second.traditional).toBe('我想吃餛飩。');
    card = noteSentenceShown(card, second.traditional, ago(1), 'reveal');
    expect(chooseSentence(card, pool, now, 'reveal')!.traditional).toBe('這家的餛飩皮很薄。');
    // A cloze counts as a showing too.
    card = noteSentenceShown(card, '這家的餛飩皮很薄。', ago(0.5), 'cloze');
    expect(chooseSentence(card, pool, now, 'reveal')!.traditional).toBe('我想吃餛飩。');
  });

  it('holds a clozed sentence back for a week and sits the word out when none is left', () => {
    let card = wontons();
    const pool = [card];
    card = noteSentenceShown(card, '這家的餛飩皮很薄。', ago(1), 'cloze');
    expect(chooseSentence(card, pool, now, 'cloze')!.traditional).toBe('我想吃餛飩。');
    card = noteSentenceShown(card, '我想吃餛飩。', ago(2), 'cloze');
    expect(chooseSentence(card, pool, now, 'cloze')).toBeNull();
    // Eight days on, the first sentence has cooled off.
    card = noteSentenceShown(card, '這家的餛飩皮很薄。', ago(8), 'cloze');
    expect(chooseSentence(card, pool, now, 'cloze')!.traditional).toBe('這家的餛飩皮很薄。');
  });

  it('prefers not to cloze the sentence the last reveal showed', () => {
    let card = wontons();
    card = noteSentenceShown(card, '這家的餛飩皮很薄。', ago(0.1), 'reveal');
    expect(chooseSentence(card, [card], now, 'cloze')!.traditional).toBe('我想吃餛飩。');
    // …unless it is the only one not cooling off.
    card = noteSentenceShown(card, '我想吃餛飩。', ago(1), 'cloze');
    expect(chooseSentence(card, [card], now, 'cloze')!.traditional).toBe('這家的餛飩皮很薄。');
  });

  it('remembers the latest showing per sentence and route, up to a limit', () => {
    let card = makeCard();
    card = noteSentenceShown(card, 'A', ago(3), 'reveal');
    card = noteSentenceShown(card, 'A', ago(2), 'cloze');
    card = noteSentenceShown(card, 'A', ago(1), 'reveal');
    expect(card.sentencesShown).toEqual([
      { text: 'A', at: ago(2), via: 'cloze' },
      { text: 'A', at: ago(1), via: 'reveal' },
    ]);
    for (let i = 0; i < 20; i += 1) card = noteSentenceShown(card, `S${i}`, ago(0), 'reveal');
    expect(card.sentencesShown).toHaveLength(SENTENCES_SHOWN_LIMIT);
    expect(card.sentencesShown!.at(-1)!.text).toBe('S19');
  });

  it('cuts the blank from the sentence it is given and names a borrowed host', () => {
    const card = wontons();
    const host = makeCard({
      traditional: '包',
      pinyin: 'bāo',
      fsrs: reviewState({ stability: 12 }),
      exampleSentenceTraditional: '阿嬤在包餛飩。',
      exampleSentencePinyin: 'Āmà zài bāo húntun.',
      exampleSentenceTranslation: 'Grandma is wrapping wontons.',
    });
    const pool = [card, host, ...makePool()];
    const sentence = borrowedSentences(card, pool)[0];
    const ex = buildClozeExercise(card, pool, mulberry32(1), { sentence })!;
    expect(ex.sentence).toBe('阿嬤在包餛飩。');
    expect(ex.hostCardId).toBe(host.id);
    expect(ex.before + ex.after).toBe('阿嬤在包。');
    expect(ex.sentencePinyin).toBe('Āmà zài bāo húntun.');
    expect(ex.translation).toBe('Grandma is wrapping wontons.');
    // The host's own word is in the sentence, so it is never an option.
    expect(ex.options).not.toContain('包');
    const own = buildClozeExercise(card, pool, mulberry32(1))!;
    expect(own.sentence).toBe('這家的餛飩皮很薄。');
    expect(own.hostCardId).toBeUndefined();
  });

  it('keeps the blank the same width whatever the answer', () => {
    expect(clozeBlank()).toBe('＿＿＿');
    expect(clozeBlank()).toHaveLength(CLOZE_BLANK_WIDTH);
  });

  it('offers readable words that share a character with the answer before any other', () => {
    const pool = [
      ...makePool(),
      makeCard({ traditional: '魚丸湯', pinyin: 'yú wán tāng', definition: 'Fish ball soup' }),
      makeCard({ traditional: '餛飩湯', pinyin: 'hún tun tāng', definition: 'Wonton soup' }),
      makeCard({ traditional: '蚵仔煎', pinyin: 'ô á jian', definition: 'Oyster omelette' }),
    ];
    const soup = pool.find((c) => c.traditional === '貢丸湯')!;
    for (const seed of [1, 2, 3, 4, 5]) {
      const { words } = pickClozeDistractors(soup, pool, 3, mulberry32(seed));
      expect(words).toHaveLength(2);
      expect(words).toContain('魚丸湯');
      expect(words).toContain('餛飩湯');
    }
  });
});
