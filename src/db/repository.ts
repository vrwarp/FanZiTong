import { DEFAULT_SETTINGS, type ReviewLog, type UserSettings, type VocabCard } from '@/types';
import { db as defaultDb, type FanZiTongDatabase } from './database';

export const META_KEYS = {
  seededAt: 'seededAt',
  schemaVersion: 'schemaVersion',
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
      await db.transaction('rw', db.cards, db.reviewLogs, db.settings, db.meta, async () => {
        await Promise.all([
          db.cards.clear(),
          db.reviewLogs.clear(),
          db.settings.clear(),
          db.meta.clear(),
        ]);
      });
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
export const repository = createRepository();
