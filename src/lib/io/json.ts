import { z } from 'zod';
import {
  DEFAULT_SETTINGS,
  DOMAIN_CATEGORIES,
  type DeckExport,
  type FsrsState,
  type ReviewLog,
  type UserSettings,
  type VocabCard,
} from '@/types';
import { numberedToMarks } from '@/lib/util/pinyin';
import { normalizeDomain, splitList } from './domain';
import type { ImportRow, ParseIssue } from './types';

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid ISO timestamp');

export const fsrsStateSchema = z.object({
  due: isoDate,
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsed_days: z.number().nonnegative(),
  scheduled_days: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: z.number().int().min(0).max(3),
  last_review: isoDate.optional(),
  learning_steps: z.number().int().nonnegative().optional(),
});

const stringList = z
  .union([z.array(z.union([z.string(), z.number()])), z.string()])
  .optional()
  .transform((v) => splitList(v ?? []));

export const importCardSchema = z.object({
  id: z.string().optional(),
  traditional: z.string().trim().min(1, 'traditional is required'),
  pinyin: z.string().optional().default(''),
  definition: z.string().optional().default(''),
  domain: z.string().optional(),
  tags: stringList,
  exampleSentenceTraditional: z.string().optional(),
  exampleSentencePinyin: z.string().optional(),
  exampleSentenceTranslation: z.string().optional(),
  visualFoils: stringList,
  variants: stringList,
  spoken: z.string().optional(),
  variantNote: z.string().optional(),
  clozeDistractors: stringList,
  fsrs: fsrsStateSchema.optional(),
  createdAt: isoDate.optional(),
  updatedAt: isoDate.optional(),
});

export const reviewLogSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  exerciseType: z.enum(['rapid_recognition', 'cloze', 'realia_menu', 'foil_discrimination']),
  reviewTimestamp: isoDate,
  timeSpentMs: z.number().nonnegative(),
  stability: z.number(),
  difficulty: z.number(),
  scheduled_days: z.number(),
  lapses: z.number().int().nonnegative(),
});

export const settingsSchema = z.object({
  targetRetention: z.number().min(0.5).max(0.99).optional(),
  maxDailyReviews: z.number().int().min(0).optional(),
  maxDailyNewCards: z.number().int().min(0).optional(),
  leechThreshold: z.number().int().min(1).optional(),
  pinyinRevealDelayMs: z.number().int().min(0).optional(),
  activeDomains: z.array(z.enum(DOMAIN_CATEGORIES)).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

export const deckSchema = z.object({
  version: z.union([z.string(), z.number()]).optional(),
  exportedAt: z.string().optional(),
  deckName: z.string().optional(),
  cards: z.array(z.unknown()),
  reviewLogs: z.array(reviewLogSchema).optional(),
  settings: settingsSchema.optional(),
});

export interface ParsedJsonDeck {
  deckName: string;
  rows: ImportRow[];
  reviewLogs: ReviewLog[];
  settings?: Partial<UserSettings>;
  issues: ParseIssue[];
}

/** Parse a PRD §7.1 JSON deck (or a full backup). Never throws. */
export function parseJsonDeck(text: string): ParsedJsonDeck {
  const issues: ParseIssue[] = [];
  const empty: ParsedJsonDeck = { deckName: '', rows: [], reviewLogs: [], issues };

  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (err) {
    issues.push({ row: 0, message: `Not valid JSON: ${(err as Error).message}` });
    return empty;
  }

  // Accept a bare array of cards as well as the canonical envelope.
  const envelope = Array.isArray(raw) ? { cards: raw } : raw;
  const deck = deckSchema.safeParse(envelope);
  if (!deck.success) {
    issues.push({
      row: 0,
      message: `Unrecognized deck format: ${deck.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
        .join('; ')}`,
    });
    return empty;
  }

  const rows: ImportRow[] = [];
  deck.data.cards.forEach((rawCard, index) => {
    const sourceIndex = index + 1;
    const parsed = importCardSchema.safeParse(rawCard);
    if (!parsed.success) {
      issues.push({
        row: sourceIndex,
        message: `Card skipped: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      });
      return;
    }
    const c = parsed.data;
    const warnings: string[] = [];
    const domain = normalizeDomain(c.domain);
    if (c.domain && !domain) {
      warnings.push(`Unknown domain "${c.domain}" — will use "custom" unless overridden.`);
    }
    if (!c.pinyin.trim()) warnings.push('No pinyin provided.');
    if (!c.definition.trim()) warnings.push('No definition provided.');

    const row: ImportRow = {
      id: c.id,
      traditional: c.traditional,
      pinyin: numberedToMarks(c.pinyin.trim()),
      definition: c.definition.trim(),
      domain,
      tags: c.tags,
      visualFoils: c.visualFoils,
      variants: c.variants,
      clozeDistractors: c.clozeDistractors,
      fsrs: c.fsrs as FsrsState | undefined,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      warnings,
      sourceIndex,
    };
    if (c.exampleSentenceTraditional?.trim()) {
      row.exampleSentenceTraditional = c.exampleSentenceTraditional.trim();
    }
    if (c.exampleSentencePinyin?.trim()) {
      row.exampleSentencePinyin = numberedToMarks(c.exampleSentencePinyin.trim());
    }
    if (c.exampleSentenceTranslation?.trim()) {
      row.exampleSentenceTranslation = c.exampleSentenceTranslation.trim();
    }
    if (c.spoken?.trim()) row.spoken = c.spoken.trim();
    if (c.variantNote?.trim()) row.variantNote = c.variantNote.trim();
    rows.push(row);
  });

  return {
    deckName: deck.data.deckName ?? '',
    rows,
    reviewLogs: (deck.data.reviewLogs ?? []) as ReviewLog[],
    settings: deck.data.settings as Partial<UserSettings> | undefined,
    issues,
  };
}

export interface ExportOptions {
  deckName?: string;
  reviewLogs?: ReviewLog[];
  settings?: UserSettings;
  now?: Date;
}

/** Build a PRD §7.1 deck object; pass reviewLogs/settings for a full backup. */
export function toJsonDeck(cards: VocabCard[], options: ExportOptions = {}): DeckExport {
  const deck: DeckExport = {
    version: '1.0',
    exportedAt: (options.now ?? new Date()).toISOString(),
    deckName: options.deckName ?? 'FanZiTong deck',
    cards,
  };
  if (options.reviewLogs) deck.reviewLogs = options.reviewLogs;
  if (options.settings) deck.settings = { ...DEFAULT_SETTINGS, ...options.settings };
  return deck;
}

export function serializeJsonDeck(deck: DeckExport): string {
  return JSON.stringify(deck, null, 2);
}
