import type { ReviewLog, UserSettings } from '@/types';
import { parseCsv } from './csv';
import { parseJsonDeck } from './json';
import type { ImportRow, ParseIssue } from './types';

export interface ImportSource {
  fileName: string;
  text: string;
}

export interface ParsedImportFile {
  kind: 'csv' | 'json';
  rows: ImportRow[];
  issues: ParseIssue[];
  reviewLogs: ReviewLog[];
  settings?: Partial<UserSettings>;
  deckName: string;
}

/** Detect CSV vs JSON (by extension, then by content) and parse accordingly. */
export function parseImportFile(source: ImportSource): ParsedImportFile {
  const trimmed = source.text.replace(/^\uFEFF/, '').trimStart();
  const looksJson =
    source.fileName.toLowerCase().endsWith('.json') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[');
  if (looksJson) {
    const deck = parseJsonDeck(source.text);
    return {
      kind: 'json',
      rows: deck.rows,
      issues: deck.issues,
      reviewLogs: deck.reviewLogs,
      settings: deck.settings,
      deckName: deck.deckName,
    };
  }
  const csv = parseCsv(source.text);
  return { kind: 'csv', rows: csv.rows, issues: csv.issues, reviewLogs: [], deckName: '' };
}
