import Dexie, { type EntityTable } from 'dexie';
import type { AiBatch, AiChange, ReviewLog, UserSettings, VocabCard } from '@/types';

export interface SettingsRow extends UserSettings {
  /** Single-row table; the id is always "user". */
  id: 'user';
}

export interface MetaRow {
  key: string;
  value: string;
}

export const DB_NAME = 'fanzitong';

/**
 * IndexedDB schema (Dexie).
 *
 * Indexes are chosen for the hot queries: due-queue building (`fsrs.due`,
 * `fsrs.state`), leech inspection (`fsrs.lapses`), domain filtering and
 * per-card review history.
 */
export class FanZiTongDatabase extends Dexie {
  cards!: EntityTable<VocabCard, 'id'>;
  reviewLogs!: EntityTable<ReviewLog, 'id'>;
  settings!: EntityTable<SettingsRow, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;
  /** Assistant edits, kept so any batch can be undone. */
  aiBatches!: EntityTable<AiBatch, 'id'>;
  aiChanges!: EntityTable<AiChange, 'id'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      cards: 'id, traditional, domain, fsrs.due, fsrs.state, fsrs.lapses, createdAt, *tags',
      reviewLogs: 'id, cardId, reviewTimestamp, [cardId+reviewTimestamp]',
      settings: 'id',
      meta: 'key',
    });
    // v2 only adds the assistant journal, so existing data needs no upgrade step.
    this.version(2).stores({
      aiBatches: 'id, createdAt, conversationId, turnId, undoneAt',
      aiChanges: 'id, batchId, cardId, [batchId+seq]',
    });
  }
}

export const db = new FanZiTongDatabase();

/** Create an isolated database instance (used by tests). */
export function createDatabase(name: string): FanZiTongDatabase {
  return new FanZiTongDatabase(name);
}
