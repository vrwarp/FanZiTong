import {
  DEFAULT_SETTINGS,
  type AiBatch,
  type AiChange,
  type ReviewLog,
  type UserSettings,
  type VocabCard,
} from '@/types';
import { db as defaultDb, type FanZiTongDatabase } from './database';

export const META_KEYS = {
  seededAt: 'seededAt',
  schemaVersion: 'schemaVersion',
  lastBackupAt: 'lastBackupAt',
  /** Local day (YYYY-MM-DD) on which the learner tapped "Done for today". */
  doneForTodayDate: 'doneForTodayDate',
} as const;

/**
 * Thin data-access layer over Dexie so pages/hooks never touch table
 * internals directly. Every function accepts an optional database so the
 * same code runs against an isolated instance in tests.
 */
export function createRepository(db: FanZiTongDatabase = defaultDb) {
  return {
    db,

    // ---- cards -------------------------------------------------------
    async getAllCards(): Promise<VocabCard[]> {
      return db.cards.toArray();
    },
    async getCard(id: string): Promise<VocabCard | undefined> {
      return db.cards.get(id);
    },
    async getCards(ids: string[]): Promise<VocabCard[]> {
      const rows = await db.cards.bulkGet(ids);
      return rows.filter((c): c is VocabCard => Boolean(c));
    },
    async putCard(card: VocabCard): Promise<void> {
      await db.cards.put(card);
    },
    async putCards(cards: VocabCard[]): Promise<void> {
      await db.cards.bulkPut(cards);
    },
    async deleteCard(id: string): Promise<void> {
      await db.transaction('rw', db.cards, db.reviewLogs, async () => {
        await db.cards.delete(id);
        await db.reviewLogs.where('cardId').equals(id).delete();
      });
    },
    async countCards(): Promise<number> {
      return db.cards.count();
    },
    async findByTraditional(traditional: string): Promise<VocabCard | undefined> {
      return db.cards.where('traditional').equals(traditional).first();
    },

    // ---- review logs ------------------------------------------------
    async addReviewLog(log: ReviewLog): Promise<void> {
      await db.reviewLogs.put(log);
    },
    async getAllReviewLogs(): Promise<ReviewLog[]> {
      return db.reviewLogs.orderBy('reviewTimestamp').toArray();
    },
    async getReviewLogsSince(sinceIso: string): Promise<ReviewLog[]> {
      return db.reviewLogs.where('reviewTimestamp').aboveOrEqual(sinceIso).toArray();
    },
    async getReviewLogsForCard(cardId: string): Promise<ReviewLog[]> {
      return db.reviewLogs.where('cardId').equals(cardId).sortBy('reviewTimestamp');
    },

    /** Atomically persist a rated card together with its review log. */
    async recordReview(card: VocabCard, log: ReviewLog): Promise<void> {
      await db.transaction('rw', db.cards, db.reviewLogs, async () => {
        await db.cards.put(card);
        await db.reviewLogs.put(log);
      });
    },

    // ---- settings ---------------------------------------------------
    async getSettings(): Promise<UserSettings> {
      const row = await db.settings.get('user');
      if (!row) return { ...DEFAULT_SETTINGS };
      const { id: _id, ...settings } = row;
      return { ...DEFAULT_SETTINGS, ...settings };
    },
    async saveSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
      const current = await this.getSettings();
      const next: UserSettings = { ...current, ...patch };
      await db.settings.put({ id: 'user', ...next });
      return next;
    },

    // ---- meta -------------------------------------------------------
    async getMeta(key: string): Promise<string | undefined> {
      return (await db.meta.get(key))?.value;
    },
    async setMeta(key: string, value: string): Promise<void> {
      await db.meta.put({ key, value });
    },

    // ---- bulk / maintenance ------------------------------------------
    async importCards(cards: VocabCard[], logs: ReviewLog[] = []): Promise<void> {
      await db.transaction('rw', db.cards, db.reviewLogs, async () => {
        await db.cards.bulkPut(cards);
        if (logs.length > 0) await db.reviewLogs.bulkPut(logs);
      });
    },
    async clearAll(): Promise<void> {
      await db.transaction(
        'rw',
        [db.cards, db.reviewLogs, db.settings, db.meta, db.aiBatches, db.aiChanges],
        async () => {
          await Promise.all([
            db.cards.clear(),
            db.reviewLogs.clear(),
            db.settings.clear(),
            db.meta.clear(),
            db.aiBatches.clear(),
            db.aiChanges.clear(),
          ]);
        },
      );
    },

    // ---- assistant journal -------------------------------------------
    /**
     * Apply one assistant tool call: the card writes and the journal rows that
     * let the learner undo them land in a single transaction, so a half-applied
     * batch can never be left behind.
     */
    async applyAssistantBatch(batch: AiBatch, changes: AiChange[]): Promise<void> {
      await db.transaction('rw', db.cards, db.reviewLogs, db.aiBatches, db.aiChanges, async () => {
        const upserts = changes
          .filter((c) => c.op !== 'delete' && c.after)
          .map((c) => c.after as VocabCard);
        if (upserts.length > 0) await db.cards.bulkPut(upserts);

        for (const change of changes) {
          if (change.op !== 'delete') continue;
          await db.cards.delete(change.cardId);
          await db.reviewLogs.where('cardId').equals(change.cardId).delete();
        }
        // A merge re-parents the losing card's history onto the survivor.
        const moved = changes.flatMap((c) => (c.op === 'update' ? (c.reviewLogs ?? []) : []));
        if (moved.length > 0) await db.reviewLogs.bulkPut(moved);

        await db.aiBatches.put(batch);
        if (changes.length > 0) await db.aiChanges.bulkPut(changes);
      });
    },

    async listAssistantBatches(limit = 50): Promise<AiBatch[]> {
      return db.aiBatches.orderBy('createdAt').reverse().limit(limit).toArray();
    },

    async getAssistantBatch(batchId: string): Promise<AiBatch | undefined> {
      return db.aiBatches.get(batchId);
    },

    async getAssistantChanges(batchId: string): Promise<AiChange[]> {
      const rows = await db.aiChanges.where('batchId').equals(batchId).toArray();
      return rows.sort((a, b) => a.seq - b.seq);
    },

    /**
     * Put the deck back the way it was before one batch.
     *
     * Scheduling is never rolled back: a card whose text the assistant changed
     * keeps the FSRS state it has now, because the learner has studied it since.
     */
    async undoAssistantBatch(batchId: string): Promise<{ restored: number; error?: string }> {
      return db.transaction('rw', db.cards, db.reviewLogs, db.aiBatches, db.aiChanges, async () => {
        const batch = await db.aiBatches.get(batchId);
        if (!batch) return { restored: 0, error: 'That change is no longer in the log.' };
        if (batch.undoneAt) return { restored: 0, error: 'That change was already undone.' };
        const changes = (await db.aiChanges.where('batchId').equals(batchId).toArray()).sort(
          (a, b) => b.seq - a.seq,
        );

        let restored = 0;
        let error: string | undefined;
        for (const change of changes) {
          const current = await db.cards.get(change.cardId);
          if (change.op === 'insert') {
            await db.cards.delete(change.cardId);
            await db.reviewLogs.where('cardId').equals(change.cardId).delete();
            restored += 1;
          } else if (change.op === 'update' && change.before) {
            await db.cards.put(current ? { ...change.before, fsrs: current.fsrs } : change.before);
            // Undo a merge: send the borrowed history back where it came from.
            for (const log of change.reviewLogs ?? []) await db.reviewLogs.put(log);
            restored += 1;
          } else if (change.op === 'delete' && change.before) {
            const clash = await db.cards
              .where('traditional')
              .equals(change.before.traditional)
              .first();
            if (clash && clash.id !== change.before.id) {
              error = `“${change.before.traditional}” is back in your deck already, so it was left as it is.`;
              continue;
            }
            await db.cards.put(change.before);
            if (change.reviewLogs?.length) await db.reviewLogs.bulkPut(change.reviewLogs);
            restored += 1;
          }
        }

        await db.aiBatches.put({ ...batch, undoneAt: new Date().toISOString(), undoError: error });
        return { restored, error };
      });
    },

    /** Keep the change log from growing without bound. */
    async pruneAssistantJournal(keep = 200, maxAgeDays = 30): Promise<number> {
      const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
      const all = await db.aiBatches.orderBy('createdAt').reverse().toArray();
      const doomed = all.filter((b, index) => index >= keep || b.createdAt < cutoff);
      if (doomed.length === 0) return 0;
      const ids = doomed.map((b) => b.id);
      await db.transaction('rw', db.aiBatches, db.aiChanges, async () => {
        await db.aiBatches.bulkDelete(ids);
        await db.aiChanges.where('batchId').anyOf(ids).delete();
      });
      return ids.length;
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
export const repository = createRepository();
