import { createDatabase } from '@/db/database';
import { createRepository } from '@/db/repository';
import { makeCard, makeLog } from '@/test/factories';
import { buildBatch, describeCounts } from './journal';

function freshRepo(name: string) {
  return createRepository(createDatabase(name));
}

describe('buildBatch', () => {
  it('numbers changes and counts them by operation', () => {
    const a = makeCard({});
    const b = makeCard({ traditional: '牛肉麵', pinyin: 'niú ròu miàn' });
    const { batch, changes } = buildBatch({
      tool: 'deck_upsert_cards',
      reason: 'Added a sentence',
      changes: [
        { op: 'insert', cardId: a.id, before: null, after: a },
        { op: 'update', cardId: b.id, before: b, after: { ...b, notes: 'new' } },
      ],
    });
    expect(batch.counts).toEqual({ inserted: 1, updated: 1, deleted: 0 });
    expect(batch.summary).toBe('1 added, 1 updated');
    expect(changes.map((c) => c.seq)).toEqual([0, 1]);
    expect(changes.every((c) => c.batchId === batch.id)).toBe(true);
  });

  it('describes an empty batch', () => {
    expect(describeCounts({ inserted: 0, updated: 0, deleted: 0 })).toBe('No changes');
  });
});

describe('assistant journal in the repository', () => {
  it('applies inserts and undoes them', async () => {
    const repo = freshRepo('journal-insert');
    const card = makeCard({});
    const { batch, changes } = buildBatch({
      tool: 'deck_upsert_cards',
      reason: 'Added a word',
      changes: [{ op: 'insert', cardId: card.id, before: null, after: card }],
    });
    await repo.applyAssistantBatch(batch, changes);
    expect(await repo.countCards()).toBe(1);

    const result = await repo.undoAssistantBatch(batch.id);
    expect(result.restored).toBe(1);
    expect(await repo.countCards()).toBe(0);
    expect((await repo.getAssistantBatch(batch.id))?.undoneAt).toBeTruthy();
    await repo.db.delete();
  });

  it('keeps the learner’s scheduling when undoing a content change', async () => {
    const repo = freshRepo('journal-update');
    const original = makeCard({ notes: undefined });
    await repo.putCard(original);
    const edited = { ...original, notes: 'A mnemonic' };
    const { batch, changes } = buildBatch({
      tool: 'deck_upsert_cards',
      reason: 'Added a note',
      changes: [{ op: 'update', cardId: original.id, before: original, after: edited }],
    });
    await repo.applyAssistantBatch(batch, changes);
    expect((await repo.getCard(original.id))?.notes).toBe('A mnemonic');

    // The learner studies the card after the assistant touched it.
    const studied = { ...edited, fsrs: { ...edited.fsrs, reps: 7, state: 2 } };
    await repo.putCard(studied);

    await repo.undoAssistantBatch(batch.id);
    const after = await repo.getCard(original.id);
    expect(after?.notes).toBeUndefined();
    expect(after?.fsrs.reps).toBe(7);
    await repo.db.delete();
  });

  it('restores a deleted card together with its review history', async () => {
    const repo = freshRepo('journal-delete');
    const card = makeCard({});
    const logs = [makeLog({ cardId: card.id }), makeLog({ cardId: card.id })];
    await repo.importCards([card], logs);

    const { batch, changes } = buildBatch({
      tool: 'deck_delete_cards',
      reason: 'Duplicate',
      changes: [{ op: 'delete', cardId: card.id, before: card, after: null, reviewLogs: logs }],
    });
    await repo.applyAssistantBatch(batch, changes);
    expect(await repo.getCard(card.id)).toBeUndefined();
    expect(await repo.getReviewLogsForCard(card.id)).toHaveLength(0);

    await repo.undoAssistantBatch(batch.id);
    expect(await repo.getCard(card.id)).toBeTruthy();
    expect(await repo.getReviewLogsForCard(card.id)).toHaveLength(2);
    await repo.db.delete();
  });

  it('refuses to restore a deleted card when the word is back in the deck', async () => {
    const repo = freshRepo('journal-clash');
    const card = makeCard({});
    await repo.putCard(card);
    const { batch, changes } = buildBatch({
      tool: 'deck_delete_cards',
      reason: 'Removed',
      changes: [{ op: 'delete', cardId: card.id, before: card, after: null }],
    });
    await repo.applyAssistantBatch(batch, changes);
    await repo.putCard(makeCard({ traditional: card.traditional }));

    const result = await repo.undoAssistantBatch(batch.id);
    expect(result.error).toMatch(/already/);
    await repo.db.delete();
  });

  it('will not undo the same batch twice', async () => {
    const repo = freshRepo('journal-twice');
    const card = makeCard({});
    const { batch, changes } = buildBatch({
      tool: 'deck_upsert_cards',
      reason: 'Added',
      changes: [{ op: 'insert', cardId: card.id, before: null, after: card }],
    });
    await repo.applyAssistantBatch(batch, changes);
    await repo.undoAssistantBatch(batch.id);
    const second = await repo.undoAssistantBatch(batch.id);
    expect(second.error).toMatch(/already/);
    await repo.db.delete();
  });

  it('lists batches newest first and prunes beyond the keep limit', async () => {
    const repo = freshRepo('journal-prune');
    const start = Date.now() - 3 * 60_000;
    for (let i = 0; i < 3; i += 1) {
      const card = makeCard({});
      const { batch, changes } = buildBatch({
        tool: 'deck_upsert_cards',
        reason: `Batch ${i}`,
        now: new Date(start + i * 60_000),
        changes: [{ op: 'insert', cardId: card.id, before: null, after: card }],
      });
      await repo.applyAssistantBatch(batch, changes);
    }
    const list = await repo.listAssistantBatches();
    expect(list.map((b) => b.reason)).toEqual(['Batch 2', 'Batch 1', 'Batch 0']);
    expect(await repo.pruneAssistantJournal(1)).toBe(2);
    expect(await repo.listAssistantBatches()).toHaveLength(1);
    await repo.db.delete();
  });

  it('prunes batches older than the age limit even under the keep limit', async () => {
    const repo = freshRepo('journal-prune-age');
    const card = makeCard({});
    const { batch, changes } = buildBatch({
      tool: 'deck_upsert_cards',
      reason: 'Ancient',
      now: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      changes: [{ op: 'insert', cardId: card.id, before: null, after: card }],
    });
    await repo.applyAssistantBatch(batch, changes);
    expect(await repo.pruneAssistantJournal(200, 30)).toBe(1);
    expect(await repo.getAssistantChanges(batch.id)).toEqual([]);
    await repo.db.delete();
  });

  it('is cleared by a full reset', async () => {
    const repo = freshRepo('journal-reset');
    const card = makeCard({});
    const { batch, changes } = buildBatch({
      tool: 'deck_upsert_cards',
      reason: 'Added',
      changes: [{ op: 'insert', cardId: card.id, before: null, after: card }],
    });
    await repo.applyAssistantBatch(batch, changes);
    await repo.clearAll();
    expect(await repo.listAssistantBatches()).toEqual([]);
    await repo.db.delete();
  });
});
