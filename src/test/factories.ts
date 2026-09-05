import { newFsrsState } from '@/lib/fsrs/scheduler';
import type { FsrsState, ReviewLog, VocabCard } from '@/types';

let counter = 0;

/** Deterministic UUID-shaped ids for tests. */
export function testId(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

export function makeCard(overrides: Partial<VocabCard> = {}): VocabCard {
  const now = overrides.createdAt ?? '2026-09-01T00:00:00.000Z';
  return {
    id: overrides.id ?? testId(),
    traditional: '滷肉飯',
    pinyin: 'lǔ ròu fàn',
    definition: 'Braised pork rice',
    domain: 'food',
    tags: ['staple'],
    exampleSentenceTraditional: '老闆，我要一碗滷肉飯。',
    exampleSentencePinyin: 'Lǎobǎn, wǒ yào yī wǎn lǔròufàn.',
    exampleSentenceTranslation: 'Boss, one bowl of braised pork rice.',
    visualFoils: ['魯', '鹵肉飯'],
    fsrs: newFsrsState(new Date(now)),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function reviewState(overrides: Partial<FsrsState> = {}): FsrsState {
  return {
    due: '2026-09-01T00:00:00.000Z',
    stability: 10,
    difficulty: 5,
    elapsed_days: 5,
    scheduled_days: 10,
    reps: 3,
    lapses: 0,
    state: 2,
    last_review: '2026-08-22T00:00:00.000Z',
    learning_steps: 0,
    ...overrides,
  };
}

export function makeLog(overrides: Partial<ReviewLog> = {}): ReviewLog {
  return {
    id: testId(),
    cardId: overrides.cardId ?? testId(),
    rating: 3,
    exerciseType: 'rapid_recognition',
    reviewTimestamp: '2026-09-05T08:00:00.000Z',
    timeSpentMs: 3000,
    stability: 4,
    difficulty: 5,
    scheduled_days: 4,
    lapses: 0,
    ...overrides,
  };
}

/** A small mixed-domain pool for distractor generation. */
export function makePool(): VocabCard[] {
  return [
    makeCard({ traditional: '滷肉飯', pinyin: 'lǔ ròu fàn', domain: 'food' }),
    makeCard({
      traditional: '牛肉麵',
      pinyin: 'niú ròu miàn',
      definition: 'Beef noodles',
      domain: 'food',
      exampleSentenceTraditional: '這家牛肉麵很好吃。',
      visualFoils: ['午肉麵'],
    }),
    makeCard({
      traditional: '貢丸湯',
      pinyin: 'gòng wán tāng',
      definition: 'Meatball soup',
      domain: 'food',
      exampleSentenceTraditional: '我要一碗貢丸湯。',
      visualFoils: ['貞丸湯'],
    }),
    makeCard({
      traditional: '地瓜葉',
      pinyin: 'dì guā yè',
      definition: 'Sweet potato leaves',
      domain: 'food',
      exampleSentenceTraditional: '燙青菜我要地瓜葉。',
      visualFoils: ['地爪葉'],
    }),
    makeCard({
      traditional: '團契',
      pinyin: 'tuán qì',
      definition: 'Fellowship',
      domain: 'church',
      exampleSentenceTraditional: '我們教會每週五晚上有青年團契。',
      visualFoils: ['團隊', '契合', '團夥'],
    }),
    makeCard({
      traditional: '禱告',
      pinyin: 'dǎo gào',
      definition: 'Prayer',
      domain: 'church',
      exampleSentenceTraditional: '讓我們一起禱告。',
      visualFoils: ['濤告'],
    }),
    makeCard({
      traditional: '傲嬌',
      pinyin: 'ào jiāo',
      definition: 'Tsundere',
      domain: 'anime',
      exampleSentenceTraditional: '她真是傲嬌。',
      visualFoils: ['驕傲', '傲慢'],
    }),
    makeCard({
      traditional: '傻眼',
      pinyin: 'shǎ yǎn',
      definition: 'Stunned',
      domain: 'slang',
      exampleSentenceTraditional: '大家都傻眼了。',
      visualFoils: ['白眼', '眨眼'],
    }),
  ];
}
