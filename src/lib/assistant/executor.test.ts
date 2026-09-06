import { createDatabase } from '@/db/database';
import { createRepository, type Repository } from '@/db/repository';
import { makeCard, makeLog } from '@/test/factories';
import { createToolExecutor, type AssistantContext } from './executor';

let repo: Repository;
let context: AssistantContext;
let executor: ReturnType<typeof createToolExecutor>;
let counter = 0;

beforeEach(() => {
  counter += 1;
  repo = createRepository(createDatabase(`executor-${counter}`));
  context = { route: '/vocab' };
  executor = createToolExecutor({ repository: repo, getContext: () => context });
});

afterEach(async () => {
  await repo.db.delete();
});

const draft = (over: Record<string, unknown> = {}) => ({
  traditional: '珍珠奶茶',
  pinyin: 'zhēn zhū nǎi chá',
  definition: 'Bubble tea',
  domain: 'food',
  tags: ['drink'],
  ...over,
});

describe('deck_upsert_cards', () => {
  it('adds a valid card and journals it', async () => {
    const out = await executor.execute('deck_upsert_cards', {
      cards: [draft()],
      reason: 'Asked for night-market drinks',
    });
    const result = out.result as { applied: unknown[]; rejected: unknown[]; batchId: string };
    expect(out.isError).toBeFalsy();
    expect(result.applied).toHaveLength(1);
    expect(await repo.countCards()).toBe(1);
    const batches = await repo.listAssistantBatches();
    expect(batches[0].reason).toBe('Asked for night-market drinks');
    expect(batches[0].counts.inserted).toBe(1);
  });

  it('applies the good cards and reports the bad ones', async () => {
    const out = await executor.execute('deck_upsert_cards', {
      cards: [draft(), draft({ traditional: '芋圆', pinyin: 'yù yuán', definition: 'Taro balls' })],
      reason: 'Two drinks',
    });
    const result = out.result as {
      applied: { traditional: string }[];
      rejected: { traditional: string; errors: string[] }[];
    };
    expect(out.isError).toBeFalsy();
    expect(result.applied.map((a) => a.traditional)).toEqual(['珍珠奶茶']);
    expect(result.rejected[0].errors.join(' ')).toMatch(/simplified/);
    expect(await repo.countCards()).toBe(1);
  });

  it('is an error only when nothing could be applied', async () => {
    const out = await executor.execute('deck_upsert_cards', {
      cards: [draft({ traditional: '芋圆' })],
      reason: 'Bad batch',
    });
    expect(out.isError).toBe(true);
    expect(await repo.countCards()).toBe(0);
  });

  it('updates an existing card by headword and keeps its scheduling', async () => {
    const card = makeCard({ notes: undefined, fsrs: { ...makeCard({}).fsrs, reps: 4 } });
    await repo.putCard(card);
    const out = await executor.execute('deck_upsert_cards', {
      cards: [{ traditional: card.traditional, notes: 'From the assistant' }],
      reason: 'Added a note',
    });
    const result = out.result as { applied: { op: string }[] };
    expect(result.applied[0].op).toBe('updated');
    const after = await repo.getCard(card.id);
    expect(after?.notes).toBe('From the assistant');
    expect(after?.fsrs.reps).toBe(4);
    expect(await repo.countCards()).toBe(1);
  });

  it('refuses to duplicate a word already in the deck when inserting', async () => {
    await repo.putCard(makeCard({}));
    const out = await executor.execute('deck_upsert_cards', {
      cards: [
        draft({ traditional: '滷肉飯', pinyin: 'lǔ ròu fàn', definition: 'Braised pork rice' }),
      ],
      mode: 'insert',
      reason: 'Duplicate attempt',
    });
    expect(out.isError).toBe(true);
    expect(await repo.countCards()).toBe(1);
  });
});

describe('deck_delete_cards', () => {
  it('needs the id and the word to agree', async () => {
    const card = makeCard({});
    await repo.putCard(card);
    const out = await executor.execute('deck_delete_cards', {
      cards: [{ id: card.id, traditional: '牛肉麵' }],
      reason: 'Wrong key',
    });
    expect(out.isError).toBe(true);
    expect(await repo.countCards()).toBe(1);
  });

  it('deletes and journals the review history', async () => {
    const card = makeCard({});
    await repo.importCards([card], [makeLog({ cardId: card.id })]);
    const out = await executor.execute('deck_delete_cards', {
      cards: [{ id: card.id, traditional: card.traditional }],
      reason: 'Learner asked',
    });
    const result = out.result as { deleted: { reviewsRemoved: number }[]; batchId: string };
    expect(result.deleted[0].reviewsRemoved).toBe(1);
    expect(await repo.countCards()).toBe(0);
    await repo.undoAssistantBatch(result.batchId);
    expect(await repo.getReviewLogsForCard(card.id)).toHaveLength(1);
  });
});

describe('deck_merge_cards', () => {
  it('keeps one card, records the other as a variant and moves its history', async () => {
    const keep = makeCard({ traditional: '滷肉飯', notes: undefined });
    const drop = makeCard({
      traditional: '魯肉飯',
      notes: 'Common night-market spelling',
      visualFoils: undefined,
    });
    await repo.importCards([keep, drop], [makeLog({ cardId: drop.id })]);

    const out = await executor.execute('deck_merge_cards', {
      keepId: keep.id,
      mergeId: drop.id,
      reason: 'Same word, two spellings',
    });
    const result = out.result as { movedReviews: number };
    expect(result.movedReviews).toBe(1);
    const survivor = await repo.getCard(keep.id);
    expect(survivor?.variants).toContain('魯肉飯');
    expect(survivor?.notes).toBe('Common night-market spelling');
    expect(await repo.getCard(drop.id)).toBeUndefined();
    expect(await repo.getReviewLogsForCard(keep.id)).toHaveLength(1);
  });
});

describe('read tools', () => {
  it('summarises the deck and its gaps', async () => {
    await repo.importCards([
      makeCard({}),
      makeCard({
        traditional: '牛肉麵',
        pinyin: 'niú ròu miàn',
        exampleSentenceTraditional: undefined,
        visualFoils: undefined,
      }),
    ]);
    const out = await executor.execute('deck_overview', {});
    const result = out.result as { total: number; gaps: { noSentence: number; noFoils: number } };
    expect(result.total).toBe(2);
    expect(result.gaps.noSentence).toBe(1);
    expect(result.gaps.noFoils).toBe(1);
  });

  it('finds cards that are missing something', async () => {
    await repo.importCards([
      makeCard({}),
      makeCard({ traditional: '牛肉麵', pinyin: 'niú ròu miàn', visualFoils: undefined }),
    ]);
    const out = await executor.execute('deck_search', { missing: 'foils' });
    const result = out.result as { cards: { traditional: string }[] };
    expect(result.cards.map((c) => c.traditional)).toEqual(['牛肉麵']);
  });

  it('bundles character notes with the cards it returns', async () => {
    const card = makeCard({});
    await repo.putCard(card);
    const out = await executor.execute('deck_get_cards', { ids: [card.id] });
    const result = out.result as { cards: unknown[]; characters: { char: string }[] };
    expect(result.cards).toHaveLength(1);
    expect(result.characters.some((c) => c.char === '肉')).toBe(true);
  });

  it('rejects a drill on cards that cannot run it', async () => {
    const card = makeCard({ visualFoils: undefined });
    await repo.putCard(card);
    const out = await executor.execute('suggest_drill', {
      type: 'foil_discrimination',
      cardIds: [card.id],
      label: 'Practice',
    });
    expect(out.isError).toBe(true);
  });

  it('builds a drill link for eligible cards', async () => {
    const card = makeCard({});
    await repo.putCard(card);
    const out = await executor.execute('suggest_drill', {
      type: 'cloze',
      cardIds: [card.id],
      label: 'Practice these',
    });
    const result = out.result as { url: string };
    expect(result.url).toBe(`/drills/cloze?count=1&cards=${card.id}`);
  });
});

describe('study context (AC-2)', () => {
  it('never names the card while it is still hidden', async () => {
    const card = makeCard({});
    context = {
      route: '/study',
      card,
      study: { active: true, hidden: true, answered: 2, remaining: 5 },
    };
    const out = await executor.execute('study_context', {});
    expect(JSON.stringify(out.result)).not.toContain(card.traditional);
    expect(JSON.stringify(out.result)).not.toContain(card.pinyin);
  });

  it('shares the card once the learner has revealed it', async () => {
    const card = makeCard({});
    context = { route: '/study', card, study: { active: true, hidden: false } };
    const out = await executor.execute('study_context', {});
    expect(JSON.stringify(out.result)).toContain(card.traditional);
  });
});

describe('unknown tools', () => {
  it('answers with an error instead of throwing', async () => {
    const out = await executor.execute('deck_destroy', {});
    expect(out.isError).toBe(true);
  });

  it('turns a bad argument into an error result', async () => {
    const out = await executor.execute('deck_upsert_cards', { cards: [] });
    expect(out.isError).toBe(true);
  });
});
