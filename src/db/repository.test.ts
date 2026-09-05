import { DEFAULT_SETTINGS } from '@/types';
import { makeCard, makeLog } from '@/test/factories';
import { createDatabase } from './database';
import { createRepository, META_KEYS } from './repository';

describe('repository (IndexedDB via Dexie)', () => {
  let repo: ReturnType<typeof createRepository>;
  let counter = 0;

  beforeEach(() => {
    counter += 1;
    repo = createRepository(createDatabase(`test-${counter}`));
  });

  afterEach(async () => {
    await repo.db.delete();
  });

  it('stores and retrieves cards with Traditional characters intact', async () => {
    const card = makeCard({ traditional: '蚵仔煎' });
    await repo.putCard(card);
    expect(await repo.getCard(card.id)).toEqual(card);
    expect(await repo.findByTraditional('蚵仔煎')).toEqual(card);
    expect(await repo.countCards()).toBe(1);
    expect(await repo.getCards([card.id, 'nope'])).toEqual([card]);
  });

  it('records reviews atomically and lists logs in time order', async () => {
    const card = makeCard();
    await repo.putCard(card);
    const later = makeLog({ cardId: card.id, reviewTimestamp: '2026-09-05T09:00:00.000Z' });
    const earlier = makeLog({ cardId: card.id, reviewTimestamp: '2026-09-05T08:00:00.000Z' });
    await repo.recordReview({ ...card, fsrs: { ...card.fsrs, reps: 1 } }, later);
    await repo.recordReview({ ...card, fsrs: { ...card.fsrs, reps: 2 } }, earlier);
    expect((await repo.getCard(card.id))?.fsrs.reps).toBe(2);
    expect((await repo.getAllReviewLogs()).map((l) => l.id)).toEqual([earlier.id, later.id]);
    expect(await repo.getReviewLogsForCard(card.id)).toHaveLength(2);
    expect(await repo.getReviewLogsSince('2026-09-05T08:30:00.000Z')).toHaveLength(1);
  });

  it('deletes a card together with its review history', async () => {
    const card = makeCard();
    await repo.putCard(card);
    await repo.addReviewLog(makeLog({ cardId: card.id }));
    await repo.deleteCard(card.id);
    expect(await repo.getCard(card.id)).toBeUndefined();
    expect(await repo.getReviewLogsForCard(card.id)).toEqual([]);
  });

  it('returns default settings and merges patches', async () => {
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
    await repo.saveSettings({ targetRetention: 0.85 });
    await repo.saveSettings({ theme: 'dark' });
    expect(await repo.getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      targetRetention: 0.85,
      theme: 'dark',
    });
  });

  it('imports in bulk, stores meta, and clears everything', async () => {
    const cards = [makeCard(), makeCard({ traditional: '豆漿' })];
    await repo.importCards(cards, [makeLog({ cardId: cards[0].id })]);
    await repo.setMeta(META_KEYS.seededAt, 'x');
    expect(await repo.countCards()).toBe(2);
    expect(await repo.getMeta(META_KEYS.seededAt)).toBe('x');
    await repo.clearAll();
    expect(await repo.countCards()).toBe(0);
    expect(await repo.getAllReviewLogs()).toEqual([]);
    expect(await repo.getMeta(META_KEYS.seededAt)).toBeUndefined();
  });
});
