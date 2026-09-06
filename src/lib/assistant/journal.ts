/**
 * Turning a validated change into journal rows.
 *
 * The assistant applies its edits immediately, so the safety net is the log:
 * every tool call becomes one batch with a `before` and `after` snapshot per
 * card, which `repository.undoAssistantBatch` replays backwards.
 */
import type { AiBatch, AiChange, AiChangeOp, ReviewLog, VocabCard } from '@/types';
import { uuid } from '@/lib/util/id';

export interface ChangeInput {
  op: AiChangeOp;
  cardId: string;
  before: VocabCard | null;
  after: VocabCard | null;
  reviewLogs?: ReviewLog[];
}

export interface BatchInput {
  tool: string;
  reason: string;
  conversationId?: string;
  turnId?: string;
  changes: ChangeInput[];
  now?: Date;
}

export interface BuiltBatch {
  batch: AiBatch;
  changes: AiChange[];
}

/** Human summary of a batch, shown on the undo chip and in Settings. */
export function describeCounts(counts: AiBatch['counts']): string {
  const parts: string[] = [];
  if (counts.inserted) parts.push(`${counts.inserted} added`);
  if (counts.updated) parts.push(`${counts.updated} updated`);
  if (counts.deleted) parts.push(`${counts.deleted} removed`);
  if (parts.length === 0) return 'No changes';
  return parts.join(', ');
}

export function buildBatch(input: BatchInput): BuiltBatch {
  const now = input.now ?? new Date();
  const batchId = uuid();
  const counts = { inserted: 0, updated: 0, deleted: 0 };
  const changes: AiChange[] = input.changes.map((change, index) => {
    if (change.op === 'insert') counts.inserted += 1;
    else if (change.op === 'update') counts.updated += 1;
    else counts.deleted += 1;
    const row: AiChange = {
      id: uuid(),
      batchId,
      seq: index,
      cardId: change.cardId,
      op: change.op,
      before: change.before,
      after: change.after,
    };
    if (change.reviewLogs?.length) row.reviewLogs = change.reviewLogs;
    return row;
  });

  const batch: AiBatch = {
    id: batchId,
    createdAt: now.toISOString(),
    tool: input.tool,
    reason: input.reason,
    summary: describeCounts(counts),
    counts,
  };
  if (input.conversationId) batch.conversationId = input.conversationId;
  if (input.turnId) batch.turnId = input.turnId;

  return { batch, changes };
}
