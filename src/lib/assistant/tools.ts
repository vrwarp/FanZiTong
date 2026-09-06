/**
 * The tool catalog the assistant can call.
 *
 * This module is isomorphic on purpose: the sidecar imports it to register an
 * in-process MCP server, the browser imports it to execute the calls against
 * IndexedDB. It therefore may not import Dexie, React or anything DOM.
 */
import { z } from 'zod';
import { DOMAIN_CATEGORIES } from '@/types';

export const TOOL_SERVER = 'fanzitong';

/** The name the model sees for one of our tools. */
export function mcpToolName(name: ToolName): string {
  return `mcp__${TOOL_SERVER}__${name}`;
}

const uuid = z.string().uuid();
const reason = z
  .string()
  .trim()
  .min(3)
  .max(200)
  .describe('One short sentence on why, shown to the learner in the change log.');

/**
 * A card the model proposes. Only `traditional` is required; `null` clears a
 * field on an update (the CSV/JSON import path cannot express that).
 */
export const cardDraftSchema = z.object({
  id: uuid.optional().describe('Set to update an existing card.'),
  traditional: z.string().trim().min(1).max(20),
  pinyin: z.string().trim().max(80).nullish(),
  definition: z.string().trim().max(120).nullish(),
  domain: z.enum(DOMAIN_CATEGORIES).nullish(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).nullish(),
  exampleSentenceTraditional: z.string().trim().max(80).nullish(),
  exampleSentencePinyin: z.string().trim().max(200).nullish(),
  exampleSentenceTranslation: z.string().trim().max(200).nullish(),
  visualFoils: z.array(z.string().trim().min(1).max(20)).max(6).nullish(),
  variants: z.array(z.string().trim().min(1).max(20)).max(6).nullish(),
  variantNote: z.string().trim().max(200).nullish(),
  spoken: z.string().trim().max(60).nullish(),
  notes: z.string().trim().max(300).nullish(),
  clozeDistractors: z.array(z.string().trim().min(1).max(20)).max(6).nullish(),
});

export type CardDraft = z.infer<typeof cardDraftSchema>;

export const MISSING_FIELDS = [
  'sentence',
  'sentencePinyin',
  'translation',
  'foils',
  'definition',
  'pinyin',
  'notes',
  'spoken',
] as const;
export type MissingField = (typeof MISSING_FIELDS)[number];

export const DRILL_TYPES = ['cloze', 'foil_discrimination', 'realia_menu'] as const;

/** A card as the model sees it in search results: compact, no FSRS internals. */
export interface CardSummary {
  id: string;
  traditional: string;
  pinyin: string;
  definition: string;
  domain: string;
  tags: string[];
  variants?: string[];
  spoken?: string;
  hasSentence: boolean;
  sentenceAligned: boolean;
  foilCount: number;
  state: string;
  lapses: number;
  due: string;
}

export interface ToolSpec {
  description: string;
  input: z.ZodObject<z.ZodRawShape>;
  /** Writes to the deck: needs journaling, and may need confirmation. */
  mutating: boolean;
  /** Advertised to the model as a read-only hint. */
  readOnly: boolean;
}

export const TOOLS = {
  deck_overview: {
    description:
      'Counts and gaps for the whole deck: cards per domain and FSRS state, how many are missing a sentence, foils or notes, leech count, the learner’s active domains and daily limits. Call this before a deck-wide change.',
    input: z.object({}),
    mutating: false,
    readOnly: true,
  },
  deck_search: {
    description:
      'Find cards. Combine free text (matches characters, pinyin, definition, tags), a domain, a tag, an FSRS state, or a `missing` field to list the cards that still need something. Returns compact summaries.',
    input: z.object({
      query: z.string().trim().max(60).optional(),
      domain: z.enum(DOMAIN_CATEGORIES).optional(),
      tag: z.string().trim().max(30).optional(),
      state: z.enum(['new', 'learning', 'review', 'relearning']).optional(),
      missing: z.enum(MISSING_FIELDS).optional(),
      minLapses: z.number().int().min(0).max(99).optional(),
      sort: z.enum(['relevance', 'due', 'lapses', 'newest']).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    mutating: false,
    readOnly: true,
  },
  deck_get_cards: {
    description:
      'Read whole cards by id or by their exact Traditional headword, with every field plus the character info the app knows. Use before editing so you keep what is already there.',
    input: z.object({
      ids: z.array(uuid).max(20).optional(),
      traditional: z.array(z.string().trim().min(1)).max(20).optional(),
    }),
    mutating: false,
    readOnly: true,
  },
  deck_upsert_cards: {
    description:
      'Create or update cards. Every card is validated against the format contract; valid ones are applied immediately and the learner can undo the batch. Invalid ones come back with the rule they broke, so fix and call again. Send at most 20 at a time.',
    input: z.object({
      cards: z.array(cardDraftSchema).min(1).max(20),
      mode: z.enum(['upsert', 'insert', 'update']).optional(),
      reason,
    }),
    mutating: true,
    readOnly: false,
  },
  deck_delete_cards: {
    description:
      'Delete cards and their review history. Give both the id and the headword for each: they must match, which stops a wrong id from deleting the wrong word. Ask the learner first unless they just asked for it.',
    input: z.object({
      cards: z
        .array(z.object({ id: uuid, traditional: z.string().trim().min(1) }))
        .min(1)
        .max(20),
      reason,
    }),
    mutating: true,
    readOnly: false,
  },
  deck_merge_cards: {
    description:
      'Merge a duplicate into the card the learner keeps: the merged headword becomes a variant ("also written"), empty fields are filled from it, and its review history moves across. Use this instead of delete when the two are spellings of one word.',
    input: z.object({
      keepId: uuid,
      mergeId: uuid,
      asVariant: z.boolean().optional(),
      reason,
    }),
    mutating: true,
    readOnly: false,
  },
  deck_review_logs: {
    description:
      'The learner’s recent answers for specific cards: rating, exercise type and how long each took. Use it to explain why a card keeps slipping.',
    input: z.object({
      cardIds: z.array(uuid).min(1).max(10),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    mutating: false,
    readOnly: true,
  },
  stats_overview: {
    description:
      'Study statistics: streak, retention, answers per day, mastery per domain, FSRS state spread and the current leeches.',
    input: z.object({ days: z.number().int().min(7).max(90).optional() }),
    mutating: false,
    readOnly: true,
  },
  study_context: {
    description:
      'What the learner is looking at right now. During a study session the current card is only included after they have revealed it; before that you get nothing but the route.',
    input: z.object({}),
    mutating: false,
    readOnly: true,
  },
  char_info: {
    description:
      'Reading, gloss and shape "tell" for individual characters, plus which deck words use them. Use it before explaining why two characters look alike.',
    input: z.object({ chars: z.array(z.string().min(1).max(2)).min(1).max(20) }),
    mutating: false,
    readOnly: true,
  },
  menu_fit: {
    description:
      'Which order-slip section a dish name lands on (rice, noodle, soup, greens, side, snack, drink, breakfast, bento). Check food words with this so they can appear in the menu drill.',
    input: z.object({ names: z.array(z.string().trim().min(1)).min(1).max(20) }),
    mutating: false,
    readOnly: true,
  },
  suggest_drill: {
    description:
      'Offer the learner a practice run on specific cards. Returns a link the app shows as a button; cards that cannot support the drill are reported back to you.',
    input: z.object({
      type: z.enum(DRILL_TYPES),
      cardIds: z.array(uuid).min(1).max(30),
      label: z.string().trim().min(1).max(60),
    }),
    mutating: false,
    readOnly: true,
  },
  settings_update: {
    description:
      'Change a study setting (target retention, daily limits, leech threshold, reveal delay, active domains). Only when the learner asks; it is journaled and undoable.',
    input: z.object({
      targetRetention: z.number().min(0.7).max(0.99).optional(),
      maxDailyReviews: z.number().int().min(0).max(999).optional(),
      maxDailyNewCards: z.number().int().min(0).max(999).optional(),
      leechThreshold: z.number().int().min(1).max(20).optional(),
      pinyinRevealDelayMs: z.number().int().min(0).max(60000).optional(),
      activeDomains: z.array(z.enum(DOMAIN_CATEGORIES)).min(1).optional(),
      reason,
    }),
    mutating: true,
    readOnly: false,
  },
} as const satisfies Record<string, ToolSpec>;

export type ToolName = keyof typeof TOOLS;
export const TOOL_ORDER = Object.keys(TOOLS) as ToolName[];

export function isToolName(value: string): value is ToolName {
  return Object.hasOwn(TOOLS, value);
}

/**
 * Tools the sidecar auto-allows. The destructive two are left out so they go
 * through the permission callback and the learner gets a say.
 */
export const AUTO_ALLOWED_TOOLS: string[] = TOOL_ORDER.filter(
  (name) => name !== 'deck_delete_cards' && name !== 'deck_merge_cards',
).map(mcpToolName);

/** Instructions the MCP server reports to the model alongside the tools. */
export const TOOL_INSTRUCTIONS = `These tools read and write the learner's own vocabulary deck, which lives in
their browser. Writes apply immediately and every batch can be undone by the
learner, so prefer doing the work over asking permission — but search before you
create, keep batches small (≤ 20 cards), and say plainly what you changed.

A rejected card in deck_upsert_cards result is not a failure: read the rule it
broke, fix that field, and call the tool again.`;

/** An internal RPC the sidecar's prompt hook uses; never exposed to the model. */
export const APP_CONTEXT_METHOD = 'app_context';
export type RpcMethod = ToolName | typeof APP_CONTEXT_METHOD;
