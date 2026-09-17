import type { ByEar, DomainCategory, ExampleSentence, FsrsState, SentenceShown } from '@/types';

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
  /** Further sentences the word appears in. */
  extraSentences?: ExampleSentence[];
  visualFoils: string[];
  homophoneFoils: string[];
  variants: string[];
  spoken?: string;
  variantNote?: string;
  notes?: string;
  clozeDistractors: string[];
  fsrs?: FsrsState;
  /** When the scheduler last heard "Again" (backups only; see VocabCard). */
  lastAgainAt?: string;
  /** When the scheduler last heard a recognition pass (backups only). */
  lastPassAt?: string;
  /** Which sentences the word has been shown in lately (backups only). */
  sentencesShown?: SentenceShown[];
  /** Whether the word was known by ear when last asked (backups only). */
  byEar?: ByEar;
  /** Study days the word was forgotten on, after its first sight (backups only). */
  slipDays?: number;
  /** When the word was met face up before its first test (backups only). */
  introducedAt?: string;
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
