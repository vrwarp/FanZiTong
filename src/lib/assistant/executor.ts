/**
 * Running the assistant's tool calls against the learner's own deck.
 *
 * The sidecar never sees the deck: it forwards each tool call over the socket
 * and this module answers it from IndexedDB. Writes go through the validator
 * and the journal, so a bad proposal is rejected with the rule it broke and a
 * good one can still be undone.
 */
import {
  CARD_STATE_LABELS,
  CardState,
  type CardStateValue,
  type UserSettings,
  type VocabCard,
} from '@/types';
import type { Repository } from '@/db/repository';
import { charInfo } from '@/data/charInfo';
import { categorizeDish, categoryTemplate } from '@/data/menuTemplate';
import {
  computeStreak,
  dailySeries,
  domainMastery,
  dueCount,
  findLeeches,
  retentionRate,
  stateDistribution,
  totalLapses,
} from '@/lib/stats/analytics';
import { hasClozeSentence, hasFoils } from '@/lib/queue/session';
import { alignSentenceReadings } from '@/lib/util/sentenceReadings';
import { hanChars } from '@/lib/util/pinyin';
import { buildBatch, type ChangeInput } from './journal';
import {
  APP_CONTEXT_METHOD,
  TOOLS,
  isToolName,
  type CardDraft,
  type CardSummary,
  type ToolName,
} from './tools';
import { buildDeckIndex, validateCardDraft, type ValidationIssue } from './validateCard';

export interface AssistantContext {
  route: string;
  page?: string;
  /** Only ever set once the learner has revealed the card (AC-2). */
  card?: VocabCard | null;
  cardId?: string;
  study?: {
    active: boolean;
    hidden: boolean;
    answered?: number;
    remaining?: number;
  };
  lastSession?: unknown;
}

export interface ExecutorDeps {
  repository: Repository;
  /** What the learner is looking at; the provider keeps this current. */
  getContext: () => AssistantContext;
  now?: () => Date;
  /** Set by the conversation, so a change can be traced back to a reply. */
  getTurn?: () => { conversationId?: string; turnId?: string };
}

export interface ToolOutcome {
  result: unknown;
  isError?: boolean;
  /** Batches written by this call, so the UI can offer an undo chip. */
  batchIds?: string[];
}

/** Cap on how many cards one call may touch, whatever the model asks for. */
export const MAX_CARDS_PER_CALL = 20;

function stateName(state: number): string {
  return CARD_STATE_LABELS[
    (state as CardStateValue) in CARD_STATE_LABELS ? (state as CardStateValue) : 0
  ].toLowerCase();
}

export function toCardSummary(card: VocabCard): CardSummary {
  const sentence = card.exampleSentenceTraditional;
  const summary: CardSummary = {
    id: card.id,
    traditional: card.traditional,
    pinyin: card.pinyin,
    definition: card.definition,
    domain: card.domain,
    tags: card.tags,
    hasSentence: hasClozeSentence(card),
    sentenceAligned: Boolean(
      sentence &&
      card.exampleSentencePinyin &&
      alignSentenceReadings(sentence, card.exampleSentencePinyin),
    ),
    foilCount: (card.visualFoils ?? []).length,
    state: stateName(card.fsrs.state),
    lapses: card.fsrs.lapses,
    due: card.fsrs.due,
  };
  if (card.variants?.length) summary.variants = card.variants;
  if (card.spoken) summary.spoken = card.spoken;
  return summary;
}

function missingField(card: VocabCard, field: string): boolean {
  switch (field) {
    case 'sentence':
      return !hasClozeSentence(card);
    case 'sentencePinyin':
      return Boolean(card.exampleSentenceTraditional) && !card.exampleSentencePinyin;
    case 'translation':
      return Boolean(card.exampleSentenceTraditional) && !card.exampleSentenceTranslation;
    case 'foils':
      return !hasFoils(card);
    case 'definition':
      return card.definition.trim().length < 3;
    case 'pinyin':
      return card.pinyin.trim().length === 0;
    case 'notes':
      return !card.notes;
    case 'spoken':
      return !card.spoken;
    default:
      return false;
  }
}

const STATE_BY_NAME: Record<string, number> = {
  new: CardState.New,
  learning: CardState.Learning,
  review: CardState.Review,
  relearning: CardState.Relearning,
};

function issueText(issues: ValidationIssue[]): string[] {
  return issues.map((issue) => issue.message);
}

export function createToolExecutor(deps: ExecutorDeps) {
  const now = () => deps.now?.() ?? new Date();
  const repo = deps.repository;

  async function upsert(input: unknown): Promise<ToolOutcome> {
    const args = TOOLS.deck_upsert_cards.input.parse(input) as {
      cards: CardDraft[];
      mode?: 'upsert' | 'insert' | 'update';
      reason: string;
    };
    const mode = args.mode ?? 'upsert';
    const existing = await repo.getAllCards();
    const index = buildDeckIndex(existing);
    const stamp = now();

    const applied: { id: string; traditional: string; op: string; warnings: string[] }[] = [];
    const rejected: { traditional: string; errors: string[] }[] = [];
    const changes: ChangeInput[] = [];
    const batchSpellings = new Set<string>();

    args.cards.slice(0, MAX_CARDS_PER_CALL).forEach((draft, offset) => {
      const target =
        (draft.id ? index.byId.get(draft.id) : undefined) ??
        (mode !== 'insert'
          ? index.byId.get(index.spellings.get(draft.traditional.trim()) ?? '')
          : undefined) ??
        null;

      if (mode === 'update' && !target) {
        rejected.push({
          traditional: draft.traditional,
          errors: [`“${draft.traditional}” is not in the deck yet, so there is nothing to update.`],
        });
        return;
      }

      const report = validateCardDraft(draft, {
        deck: index,
        existing: target,
        batchSpellings,
        // Keep new cards in file order for the new-card queue.
        now: new Date(stamp.getTime() + offset),
      });

      if (report.errors.length > 0) {
        rejected.push({ traditional: draft.traditional, errors: issueText(report.errors) });
        return;
      }

      const card = report.card;
      if (target) {
        changes.push({ op: 'update', cardId: card.id, before: target, after: card });
        applied.push({
          id: card.id,
          traditional: card.traditional,
          op: 'updated',
          warnings: issueText(report.warnings),
        });
      } else {
        changes.push({ op: 'insert', cardId: card.id, before: null, after: card });
        applied.push({
          id: card.id,
          traditional: card.traditional,
          op: 'added',
          warnings: issueText(report.warnings),
        });
        // Keep the in-memory index current so a later card in the same batch
        // sees this one.
        index.spellings.set(card.traditional, card.id);
        index.byId.set(card.id, card);
      }
      batchSpellings.add(card.traditional);
    });

    let batchId: string | undefined;
    if (changes.length > 0) {
      const built = buildBatch({
        tool: 'deck_upsert_cards',
        reason: args.reason,
        changes,
        now: stamp,
        ...deps.getTurn?.(),
      });
      await repo.applyAssistantBatch(built.batch, built.changes);
      batchId = built.batch.id;
    }

    const deckCount = await repo.countCards();
    return {
      result: { batchId, applied, rejected, deckCount },
      isError: applied.length === 0 && rejected.length > 0,
      batchIds: batchId ? [batchId] : [],
    };
  }

  async function remove(input: unknown): Promise<ToolOutcome> {
    const args = TOOLS.deck_delete_cards.input.parse(input) as {
      cards: { id: string; traditional: string }[];
      reason: string;
    };
    const deleted: { id: string; traditional: string; reviewsRemoved: number }[] = [];
    const skipped: { id: string; why: string }[] = [];
    const changes: ChangeInput[] = [];

    for (const target of args.cards.slice(0, MAX_CARDS_PER_CALL)) {
      const card = await repo.getCard(target.id);
      if (!card) {
        skipped.push({ id: target.id, why: 'No card with that id.' });
        continue;
      }
      // Both keys must agree, so a stale id cannot delete the wrong word.
      if (card.traditional !== target.traditional.trim()) {
        skipped.push({
          id: target.id,
          why: `That id is “${card.traditional}”, not “${target.traditional}”.`,
        });
        continue;
      }
      const logs = await repo.getReviewLogsForCard(card.id);
      changes.push({ op: 'delete', cardId: card.id, before: card, after: null, reviewLogs: logs });
      deleted.push({ id: card.id, traditional: card.traditional, reviewsRemoved: logs.length });
    }

    let batchId: string | undefined;
    if (changes.length > 0) {
      const built = buildBatch({
        tool: 'deck_delete_cards',
        reason: args.reason,
        changes,
        now: now(),
        ...deps.getTurn?.(),
      });
      await repo.applyAssistantBatch(built.batch, built.changes);
      batchId = built.batch.id;
    }
    return {
      result: { batchId, deleted, skipped },
      isError: deleted.length === 0,
      batchIds: batchId ? [batchId] : [],
    };
  }

  async function merge(input: unknown): Promise<ToolOutcome> {
    const args = TOOLS.deck_merge_cards.input.parse(input) as {
      keepId: string;
      mergeId: string;
      asVariant?: boolean;
      reason: string;
    };
    if (args.keepId === args.mergeId) {
      return { result: { error: 'Those are the same card.' }, isError: true };
    }
    const keep = await repo.getCard(args.keepId);
    const drop = await repo.getCard(args.mergeId);
    if (!keep || !drop) {
      return { result: { error: 'One of those cards is not in the deck.' }, isError: true };
    }

    const variants = new Set(keep.variants ?? []);
    if (args.asVariant !== false) variants.add(drop.traditional);
    for (const v of drop.variants ?? []) if (v !== keep.traditional) variants.add(v);

    const merged: VocabCard = {
      ...keep,
      // Fill only what the survivor is missing; never overwrite its content.
      pinyin: keep.pinyin || drop.pinyin,
      definition: keep.definition || drop.definition,
      tags: keep.tags.length ? keep.tags : drop.tags,
      exampleSentenceTraditional:
        keep.exampleSentenceTraditional ?? drop.exampleSentenceTraditional,
      exampleSentencePinyin: keep.exampleSentencePinyin ?? drop.exampleSentencePinyin,
      exampleSentenceTranslation:
        keep.exampleSentenceTranslation ?? drop.exampleSentenceTranslation,
      visualFoils: keep.visualFoils?.length ? keep.visualFoils : drop.visualFoils,
      clozeDistractors: keep.clozeDistractors?.length
        ? keep.clozeDistractors
        : drop.clozeDistractors,
      spoken: keep.spoken ?? drop.spoken,
      notes: keep.notes ?? drop.notes,
      variantNote: keep.variantNote ?? drop.variantNote,
      variants: variants.size > 0 ? [...variants] : undefined,
      updatedAt: now().toISOString(),
    };

    // The merged card's history follows the word onto the survivor.
    const droppedLogs = await repo.getReviewLogsForCard(drop.id);
    const movedLogs = droppedLogs.map((log) => ({ ...log, cardId: keep.id }));

    const built = buildBatch({
      tool: 'deck_merge_cards',
      reason: args.reason,
      now: now(),
      ...deps.getTurn?.(),
      changes: [
        { op: 'update', cardId: keep.id, before: keep, after: merged, reviewLogs: movedLogs },
        { op: 'delete', cardId: drop.id, before: drop, after: null, reviewLogs: droppedLogs },
      ],
    });
    await repo.applyAssistantBatch(built.batch, built.changes);

    return {
      result: {
        batchId: built.batch.id,
        kept: toCardSummary(merged),
        merged: drop.traditional,
        movedReviews: movedLogs.length,
      },
      batchIds: [built.batch.id],
    };
  }

  async function overview(): Promise<ToolOutcome> {
    const [cards, settings] = await Promise.all([repo.getAllCards(), repo.getSettings()]);
    const gaps = {
      noSentence: cards.filter((c) => !hasClozeSentence(c)).length,
      noFoils: cards.filter((c) => !hasFoils(c)).length,
      noNotes: cards.filter((c) => !c.notes).length,
      unalignedSentence: cards.filter(
        (c) =>
          c.exampleSentenceTraditional &&
          (!c.exampleSentencePinyin ||
            !alignSentenceReadings(c.exampleSentenceTraditional, c.exampleSentencePinyin)),
      ).length,
    };
    const byDomain: Record<string, number> = {};
    for (const card of cards) byDomain[card.domain] = (byDomain[card.domain] ?? 0) + 1;
    const tags = new Map<string, number>();
    for (const card of cards) for (const tag of card.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);

    return {
      result: {
        total: cards.length,
        byDomain,
        states: stateDistribution(cards),
        due: dueCount(cards, now()),
        gaps,
        leeches: findLeeches(cards, settings.leechThreshold).length,
        topTags: [...tags.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 30)
          .map(([tag, count]) => ({ tag, count })),
        settings: {
          activeDomains: settings.activeDomains,
          maxDailyNewCards: settings.maxDailyNewCards,
          maxDailyReviews: settings.maxDailyReviews,
          leechThreshold: settings.leechThreshold,
        },
      },
    };
  }

  async function search(input: unknown): Promise<ToolOutcome> {
    const args = TOOLS.deck_search.input.parse(input) as {
      query?: string;
      domain?: string;
      tag?: string;
      state?: string;
      missing?: string;
      minLapses?: number;
      sort?: string;
      limit?: number;
    };
    const cards = await repo.getAllCards();
    const needle = args.query?.trim().toLowerCase();
    let hits = cards.filter((card) => {
      if (args.domain && card.domain !== args.domain) return false;
      if (args.tag && !card.tags.includes(args.tag)) return false;
      if (args.state !== undefined && card.fsrs.state !== STATE_BY_NAME[args.state]) return false;
      if (args.minLapses !== undefined && card.fsrs.lapses < args.minLapses) return false;
      if (args.missing && !missingField(card, args.missing)) return false;
      if (!needle) return true;
      return [card.traditional, card.pinyin, card.definition, card.spoken ?? '', ...card.tags]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });

    if (args.sort === 'due') {
      hits = hits.sort((a, b) => a.fsrs.due.localeCompare(b.fsrs.due));
    } else if (args.sort === 'lapses') {
      hits = hits.sort((a, b) => b.fsrs.lapses - a.fsrs.lapses);
    } else if (args.sort === 'newest') {
      hits = hits.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    const limit = args.limit ?? 20;
    return {
      result: { total: hits.length, cards: hits.slice(0, limit).map(toCardSummary) },
    };
  }

  async function getCards(input: unknown): Promise<ToolOutcome> {
    const args = TOOLS.deck_get_cards.input.parse(input) as {
      ids?: string[];
      traditional?: string[];
    };
    const found: VocabCard[] = [];
    const missing: string[] = [];
    if (args.ids?.length) {
      const rows = await repo.getCards(args.ids);
      found.push(...rows);
      const seen = new Set(rows.map((c) => c.id));
      missing.push(...args.ids.filter((id) => !seen.has(id)));
    }
    for (const word of args.traditional ?? []) {
      const card = await repo.findByTraditional(word.trim());
      if (card) {
        if (!found.some((c) => c.id === card.id)) found.push(card);
      } else {
        missing.push(word);
      }
    }
    // Bundle the character notes so explaining a look-alike needs no second call.
    const chars = new Set(found.flatMap((c) => hanChars(c.traditional)));
    const characters = [...chars]
      .map((char) => ({ char, ...(charInfo(char) ?? {}) }))
      .filter((entry) => 'pinyin' in entry);

    return { result: { cards: found, characters, missing } };
  }

  async function reviewLogs(input: unknown): Promise<ToolOutcome> {
    const args = TOOLS.deck_review_logs.input.parse(input) as {
      cardIds: string[];
      limit?: number;
    };
    const limit = args.limit ?? 50;
    const out: Record<string, unknown[]> = {};
    for (const id of args.cardIds) {
      const logs = await repo.getReviewLogsForCard(id);
      out[id] = logs.slice(-limit).map((log) => ({
        at: log.reviewTimestamp,
        rating: log.rating,
        exercise: log.exerciseType,
        ms: log.timeSpentMs,
        stateBefore: log.stateBefore,
      }));
    }
    return { result: { logs: out } };
  }

  async function stats(input: unknown): Promise<ToolOutcome> {
    const args = TOOLS.stats_overview.input.parse(input) as { days?: number };
    const days = args.days ?? 30;
    const [cards, logs, settings] = await Promise.all([
      repo.getAllCards(),
      repo.getAllReviewLogs(),
      repo.getSettings(),
    ]);
    const at = now();
    const since = new Date(at.getTime() - days * 24 * 3_600_000).toISOString();
    const recent = logs.filter((l) => l.reviewTimestamp >= since);
    return {
      result: {
        days,
        streak: computeStreak(logs, at),
        answers: recent.length,
        retention: retentionRate(recent),
        daily: dailySeries(logs, days, at),
        mastery: domainMastery(cards),
        states: stateDistribution(cards),
        lapses: totalLapses(cards),
        leeches: findLeeches(cards, settings.leechThreshold).map(toCardSummary),
      },
    };
  }

  function contextSnapshot(): ToolOutcome {
    const context = deps.getContext();
    const hidden = context.study?.hidden ?? false;
    const snapshot: Record<string, unknown> = {
      route: context.route,
      page: context.page,
      studying: context.study?.active ?? false,
    };
    if (context.study?.active) {
      snapshot.answered = context.study.answered;
      snapshot.remaining = context.study.remaining;
      // AC-2: before the learner reveals a card, the assistant does not learn
      // which card it is, so it cannot leak the reading.
      snapshot.cardHidden = hidden;
    }
    if (!hidden && context.card) snapshot.card = toCardSummary(context.card);
    if (context.lastSession) snapshot.lastSession = context.lastSession;
    return { result: snapshot };
  }

  function characters(input: unknown): ToolOutcome {
    const args = TOOLS.char_info.input.parse(input) as { chars: string[] };
    const entries = args.chars.map((char) => {
      const info = charInfo(char);
      return info ? { char, ...info } : { char, unknown: true };
    });
    return { result: { entries } };
  }

  function menuFit(input: unknown): ToolOutcome {
    const args = TOOLS.menu_fit.input.parse(input) as { names: string[] };
    const dishes = args.names.map((name) => {
      const id = categorizeDish(name);
      return { name, section: id, sectionName: categoryTemplate(id)?.name ?? id };
    });
    return { result: { dishes } };
  }

  async function drill(input: unknown): Promise<ToolOutcome> {
    const args = TOOLS.suggest_drill.input.parse(input) as {
      type: 'cloze' | 'foil_discrimination' | 'realia_menu';
      cardIds: string[];
      label: string;
    };
    const cards = await repo.getCards(args.cardIds);
    const eligible: string[] = [];
    const skipped: { id: string; why: string }[] = [];
    for (const card of cards) {
      if (args.type === 'cloze' && !hasClozeSentence(card)) {
        skipped.push({ id: card.id, why: `“${card.traditional}” has no usable sentence yet.` });
      } else if (args.type === 'foil_discrimination' && !hasFoils(card)) {
        skipped.push({ id: card.id, why: `“${card.traditional}” has no foils yet.` });
      } else if (args.type === 'realia_menu' && card.domain !== 'food') {
        skipped.push({ id: card.id, why: `“${card.traditional}” is not a food word.` });
      } else {
        eligible.push(card.id);
      }
    }
    if (eligible.length === 0) {
      return {
        result: { skipped, error: 'None of those cards can run that drill yet.' },
        isError: true,
      };
    }
    const url = `/drills/${args.type}?count=${eligible.length}&cards=${eligible.join(',')}`;
    return { result: { url, label: args.label, eligible: eligible.length, skipped } };
  }

  async function updateSettings(input: unknown): Promise<ToolOutcome> {
    const args = TOOLS.settings_update.input.parse(input) as Partial<UserSettings> & {
      reason: string;
    };
    const { reason, ...patch } = args;
    const before = await repo.getSettings();
    const after = await repo.saveSettings(patch);
    const built = buildBatch({
      tool: 'settings_update',
      reason,
      now: now(),
      ...deps.getTurn?.(),
      changes: [],
    });
    // Settings live outside the card journal, so record the swap in the batch.
    built.batch.summary = `Settings: ${Object.keys(patch).join(', ')}`;
    await repo.applyAssistantBatch(built.batch, []);
    await repo.setMeta(`assistantSettingsUndo:${built.batch.id}`, JSON.stringify(before));
    return { result: { settings: after, batchId: built.batch.id }, batchIds: [built.batch.id] };
  }

  const handlers: Record<ToolName, (input: unknown) => Promise<ToolOutcome> | ToolOutcome> = {
    deck_overview: overview,
    deck_search: search,
    deck_get_cards: getCards,
    deck_upsert_cards: upsert,
    deck_delete_cards: remove,
    deck_merge_cards: merge,
    deck_review_logs: reviewLogs,
    stats_overview: stats,
    study_context: contextSnapshot,
    char_info: characters,
    menu_fit: menuFit,
    suggest_drill: drill,
    settings_update: updateSettings,
  };

  return {
    /** Answer one call from the sidecar. Never throws: errors become results. */
    async execute(method: string, input: unknown): Promise<ToolOutcome> {
      try {
        if (method === APP_CONTEXT_METHOD) return contextSnapshot();
        if (!isToolName(method)) {
          return { result: { error: `Unknown tool “${method}”.` }, isError: true };
        }
        return await handlers[method](input);
      } catch (error) {
        return {
          result: { error: error instanceof Error ? error.message : String(error) },
          isError: true,
        };
      }
    },
  };
}

export type ToolExecutor = ReturnType<typeof createToolExecutor>;
