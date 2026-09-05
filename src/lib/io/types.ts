import type { DomainCategory, FsrsState } from '@/types';

/** A card-shaped row parsed from CSV or JSON, before it becomes a VocabCard. */
export interface ImportRow {
  id?: string;
  traditional: string;
  pinyin: string;
  definition: string;
  domain?: DomainCategory;
  tags: string[];
  exampleSentenceTraditional?: string;
  exampleSentencePinyin?: string;
  exampleSentenceTranslation?: string;
  visualFoils: string[];
  variants: string[];
  spoken?: string;
  variantNote?: string;
  clozeDistractors: string[];
  fsrs?: FsrsState;
  createdAt?: string;
  updatedAt?: string;
  /** Non-fatal notes produced while parsing this row. */
  warnings: string[];
  /** 1-based row number in the source file, for messages. */
  sourceIndex: number;
}

export interface ParseIssue {
  /** 1-based row number, or 0 for file-level issues. */
  row: number;
  message: string;
}

export interface ParseResult {
  rows: ImportRow[];
  issues: ParseIssue[];
}
