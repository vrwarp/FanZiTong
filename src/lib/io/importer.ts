import type { DomainCategory, VocabCard } from '@/types';
import { newFsrsState } from '@/lib/fsrs/scheduler';
import { isUuid, uuid } from '@/lib/util/id';
import type { ImportRow } from './types';

export type ImportRowStatus = 'new' | 'duplicate' | 'duplicate-in-file';
export type DuplicatePolicy = 'skip' | 'overwrite';

export interface PreviewRow {
  row: ImportRow;
  status: ImportRowStatus;
  /** Id of the existing card with the same characters, when status is "duplicate". */
  existingId?: string;
  messages: string[];
}

export interface ImportPreview {
  rows: PreviewRow[];
  counts: { total: number; new: number; duplicate: number; duplicateInFile: number };
}

/**
 * Compare parsed rows to the existing deck and flag duplicates by their
 * Traditional characters (PRD Journey 2, step 4).
 */
export function analyzeImport(rows: ImportRow[], existing: VocabCard[]): ImportPreview {
  const existingByWord = new Map<string, string>();
  for (const c of existing) {
    existingByWord.set(c.traditional, c.id);
    for (const v of c.variants ?? []) if (!existingByWord.has(v)) existingByWord.set(v, c.id);
  }
  const existingIds = new Set(existing.map((c) => c.id));
  const seenInFile = new Set<string>();
  const previews: PreviewRow[] = [];
  const counts = { total: rows.length, new: 0, duplicate: 0, duplicateInFile: 0 };

  for (const row of rows) {
    const messages = [...row.warnings];
    let status: ImportRowStatus = 'new';
    let existingId: string | undefined;
    if (seenInFile.has(row.traditional)) {
      status = 'duplicate-in-file';
      messages.push('Appears more than once in this file; only the first copy is imported.');
      counts.duplicateInFile += 1;
    } else {
      seenInFile.add(row.traditional);
      const byWord = existingByWord.get(row.traditional);
      const byId = row.id && existingIds.has(row.id) ? row.id : undefined;
      if (byWord || byId) {
        status = 'duplicate';
        existingId = byWord ?? byId;
        const match = existing.find((c) => c.id === existingId);
        messages.push(
          match && match.traditional !== row.traditional
            ? `Spelling variant of ${match.traditional}, already in your deck.`
            : 'Already in your deck.',
        );
        counts.duplicate += 1;
      } else {
        counts.new += 1;
      }
    }
    previews.push({ row, status, existingId, messages });
  }
  return { rows: previews, counts };
}

export interface MaterializeOptions {
  /** Force every imported card into this domain (PRD Journey 2, step 5). */
  domainOverride?: DomainCategory;
  duplicatePolicy: DuplicatePolicy;
  now?: Date;
}

export interface MaterializedImport {
  toInsert: VocabCard[];
  toUpdate: VocabCard[];
  skipped: number;
}

/** Turn a preview into concrete cards to insert/update, honouring the duplicate policy. */
export function materializeImport(
  preview: ImportPreview,
  existing: VocabCard[],
  options: MaterializeOptions,
): MaterializedImport {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const existingById = new Map(existing.map((c) => [c.id, c] as const));
  const result: MaterializedImport = { toInsert: [], toUpdate: [], skipped: 0 };
  let sequence = 0;

  for (const { row, status, existingId } of preview.rows) {
    if (status === 'duplicate-in-file') {
      result.skipped += 1;
      continue;
    }
    const domain: DomainCategory = options.domainOverride ?? row.domain ?? 'custom';
    if (status === 'duplicate' && existingId) {
      if (options.duplicatePolicy === 'skip') {
        result.skipped += 1;
        continue;
      }
      const current = existingById.get(existingId)!;
      result.toUpdate.push({
        ...current,
        traditional: row.traditional,
        pinyin: row.pinyin || current.pinyin,
        definition: row.definition || current.definition,
        domain,
        tags: row.tags.length ? row.tags : current.tags,
        exampleSentenceTraditional:
          row.exampleSentenceTraditional ?? current.exampleSentenceTraditional,
        exampleSentencePinyin: row.exampleSentencePinyin ?? current.exampleSentencePinyin,
        exampleSentenceTranslation:
          row.exampleSentenceTranslation ?? current.exampleSentenceTranslation,
        visualFoils: row.visualFoils.length ? row.visualFoils : current.visualFoils,
        variants: row.variants.length ? row.variants : current.variants,
        spoken: row.spoken ?? current.spoken,
        variantNote: row.variantNote ?? current.variantNote,
        clozeDistractors: row.clozeDistractors.length
          ? row.clozeDistractors
          : current.clozeDistractors,
        // A backup restore carries FSRS state; a plain vocab file keeps the learner's progress.
        fsrs: row.fsrs ?? current.fsrs,
        updatedAt: nowIso,
      });
      continue;
    }
    // Stagger createdAt by a millisecond so new-card order is stable and matches the file.
    const createdAt = row.createdAt ?? new Date(now.getTime() + sequence).toISOString();
    sequence += 1;
    const card: VocabCard = {
      id: row.id && isUuid(row.id) ? row.id : uuid(),
      traditional: row.traditional,
      pinyin: row.pinyin,
      definition: row.definition,
      domain,
      tags: row.tags,
      fsrs: row.fsrs ?? newFsrsState(now),
      createdAt,
      updatedAt: row.updatedAt ?? createdAt,
    };
    if (row.exampleSentenceTraditional)
      card.exampleSentenceTraditional = row.exampleSentenceTraditional;
    if (row.exampleSentencePinyin) card.exampleSentencePinyin = row.exampleSentencePinyin;
    if (row.exampleSentenceTranslation)
      card.exampleSentenceTranslation = row.exampleSentenceTranslation;
    if (row.visualFoils.length) card.visualFoils = row.visualFoils;
    if (row.variants.length) card.variants = row.variants;
    if (row.spoken) card.spoken = row.spoken;
    if (row.variantNote) card.variantNote = row.variantNote;
    if (row.clozeDistractors.length) card.clozeDistractors = row.clozeDistractors;
    result.toInsert.push(card);
  }
  return result;
}
