import type { DomainCategory, ExampleSentence, VocabCard } from '@/types';
import { newFsrsState } from '@/lib/fsrs/scheduler';
import { uuid } from '@/lib/util/id';

/**
 * The starter deck, kept out of the app bundle.
 *
 * The rows live in `starterDeck.json` and arrive through a dynamic import, so
 * they become a chunk of their own rather than something every cold start has
 * to parse. That matters because the deck is meant to keep growing: at ninety-five
 * words the difference is nothing, at several thousand it is most of a megabyte
 * of JavaScript parsed on a phone to answer a question — "has this database
 * been seeded?" — whose answer is almost always yes.
 *
 * The chunk is still precached by the service worker, so a first run with no
 * network works exactly as before.
 *
 * Compact authoring format, one row per card:
 * [traditional, pinyin, definition, tags, sentence, sentence pinyin, translation,
 *  foils, variants?, homophones?]
 * `tags`, `foils`, `variants` and `homophones` are "|"-delimited. Foils are
 * visually confusable look-alikes (radical/component swaps, near-homographs).
 * Homophones are same-reading, wrong-character spellings — the candidates an
 * IME offers — and are the §5.4 drill's first choice. Variants are accepted
 * real-world spellings (滷肉飯 → 魯肉飯) that are shown as "also written" and
 * never used as wrong answers.
 */
export type SeedEntry = [
  traditional: string,
  pinyin: string,
  definition: string,
  tags: string,
  sentence: string,
  sentencePinyin: string,
  translation: string,
  foils: string,
  variants?: string,
  homophones?: string,
  /**
   * Further sentences: "sentence|pinyin|translation" triples joined by "||".
   * The reveal and Fill the Blank rotate through them.
   */
  extraSentences?: string,
];

/** Decode the compact extra-sentence column into sentences; blank triples are dropped. */
export function parseSeedExtraSentences(value: string | undefined): ExampleSentence[] {
  if (!value) return [];
  const out: ExampleSentence[] = [];
  for (const triple of value.split('||')) {
    const [traditional = '', pinyin = '', translation = ''] = triple
      .split('|')
      .map((s) => s.trim());
    if (!traditional) continue;
    const sentence: ExampleSentence = { traditional };
    if (pinyin) sentence.pinyin = pinyin;
    if (translation) sentence.translation = translation;
    out.push(sentence);
  }
  return out;
}

export interface StarterDeckData {
  name: string;
  /** As-heard readings for words nobody says in dictionary Mandarin. */
  spoken: Record<string, string>;
  /** Notes shown after the reveal: a spelling that is only a sound, a loan, an image. */
  notes: Record<string, string>;
  /** Per-word notes about the accepted spelling variants. */
  variantNotes: Record<string, string>;
  entries: Record<Exclude<DomainCategory, 'custom'>, SeedEntry[]>;
}

export const STARTER_DECK_NAME = 'Taiwanese Heritage Vocabulary (starter)';

let pending: Promise<StarterDeckData> | null = null;

/**
 * Fetch the deck rows, once per session.
 *
 * The promise is cached rather than the value: two callers during the first
 * launch (bootstrap seeding and the vocabulary page) should share one download,
 * not race for two.
 */
export function loadStarterDeckData(): Promise<StarterDeckData> {
  // The JSON's inferred type widens the fixed-arity rows to string[], so the
  // shape is asserted here once rather than at every use.
  pending ??= import('./starterDeck.json')
    .then((m) => (m.default ?? m) as unknown as StarterDeckData)
    .catch((err: unknown) => {
      // A failed fetch must not become the cached answer. Keeping the rejected
      // promise would mean the chunk is never asked for again in this session,
      // so a tab that was offline for one moment stays broken for all of them.
      pending = null;
      throw err;
    });
  return pending;
}

export interface BuildStarterDeckOptions {
  now?: Date;
  idFactory?: () => string;
}

/** Materialize rows as brand-new (state 0) cards. */
export function materializeStarterDeck(
  data: StarterDeckData,
  options: BuildStarterDeckOptions = {},
): VocabCard[] {
  const now = options.now ?? new Date();
  const makeId = options.idFactory ?? uuid;
  const cards: VocabCard[] = [];
  let index = 0;
  for (const domain of Object.keys(data.entries) as (keyof typeof data.entries)[]) {
    for (const [
      traditional,
      pinyin,
      definition,
      tags,
      sentence,
      sentencePinyin,
      translation,
      foils,
      variants,
      homophones,
      extraSentences,
    ] of data.entries[domain]) {
      // Stagger createdAt so the new-card queue keeps authoring order.
      const createdAt = new Date(now.getTime() + index).toISOString();
      index += 1;
      const extras = parseSeedExtraSentences(extraSentences);
      cards.push({
        id: makeId(),
        traditional,
        pinyin,
        definition,
        domain,
        tags: tags.split('|').filter(Boolean),
        exampleSentenceTraditional: sentence,
        exampleSentencePinyin: sentencePinyin,
        exampleSentenceTranslation: translation,
        extraSentences: extras.length > 0 ? extras : undefined,
        visualFoils: foils.split('|').filter(Boolean),
        homophoneFoils: homophones ? homophones.split('|').filter(Boolean) : undefined,
        variants: variants ? variants.split('|').filter(Boolean) : undefined,
        variantNote: data.variantNotes[traditional],
        notes: data.notes[traditional],
        spoken: data.spoken[traditional],
        fsrs: newFsrsState(now),
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
  return cards;
}

/** The starter deck, loading the rows if they are not here yet. */
export async function buildStarterDeck(
  options: BuildStarterDeckOptions = {},
): Promise<VocabCard[]> {
  return materializeStarterDeck(await loadStarterDeckData(), options);
}

/**
 * Which starter rows a deck is missing, and which it has in a drifted form.
 *
 * "Restore" used to mean "add the headwords you do not have", which quietly
 * made it a no-op for anybody who already had them: the button went grey and
 * there was no way back to the shipped text. But a starter card drifts for two
 * ordinary reasons — the learner edited it, or a later release corrected it —
 * and neither was reachable. So the plan names both halves, and the control can
 * always say what tapping it would do.
 */
export interface StarterRestorePlan {
  /** Starter words this deck does not have at all. */
  add: VocabCard[];
  /** Cards whose content no longer matches the shipped row, rebuilt from it. */
  repair: VocabCard[];
}

/**
 * The authored fields. `id`, `fsrs`, `createdAt` and `updatedAt` are the
 * learner's rather than the deck's, so they are neither compared nor replaced.
 */
const CONTENT_KEYS = [
  'traditional',
  'pinyin',
  'spoken',
  'definition',
  'domain',
  'tags',
  'exampleSentenceTraditional',
  'exampleSentencePinyin',
  'exampleSentenceTranslation',
  'extraSentences',
  'visualFoils',
  'homophoneFoils',
  'variants',
  'variantNote',
  'notes',
  'clozeDistractors',
] as const satisfies readonly (keyof VocabCard)[];

function sameContent(held: VocabCard, shipped: VocabCard): boolean {
  // An absent field and an empty one are the same card, and the seed rows spell
  // "nothing here" both ways depending on the column.
  const norm = (value: unknown) =>
    value === undefined || value === null || (Array.isArray(value) && value.length === 0)
      ? null
      : value;
  return CONTENT_KEYS.every(
    (key) => JSON.stringify(norm(held[key])) === JSON.stringify(norm(shipped[key])),
  );
}

export function planStarterRestore(
  deck: VocabCard[],
  starter: VocabCard[],
  options: { now?: Date } = {},
): StarterRestorePlan {
  const held = new Map(deck.map((card) => [card.traditional, card]));
  const updatedAt = (options.now ?? new Date()).toISOString();
  const add: VocabCard[] = [];
  const repair: VocabCard[] = [];
  for (const shipped of starter) {
    const mine = held.get(shipped.traditional);
    if (!mine) {
      add.push(shipped);
    } else if (!sameContent(mine, shipped)) {
      // The words come back; the schedule stays the learner's. Restoring a
      // card must never cost the reviews that were done on it.
      repair.push({
        ...shipped,
        id: mine.id,
        fsrs: mine.fsrs,
        createdAt: mine.createdAt,
        updatedAt,
      });
    }
  }
  return { add, repair };
}

/**
 * How the control should read.
 *
 * `null` is "not known yet", which is not "nothing to do": the rows arrive as a
 * chunk, and if that chunk never arrives the answer is unknown for good. Saying
 * "complete" out of missing data was a claim the button had not earned — and
 * "complete" was the wrong word besides, since it sounded like a verdict on the
 * deck's size rather than on whether this copy matches the shipped one.
 */
export function starterRestoreLabel(plan: StarterRestorePlan | null): string {
  if (!plan) return 'Restore starter deck';
  const parts: string[] = [];
  if (plan.add.length > 0) parts.push(`adds ${plan.add.length}`);
  if (plan.repair.length > 0) parts.push(`repairs ${plan.repair.length}`);
  return parts.length > 0
    ? `Restore starter deck (${parts.join(', ')})`
    : 'Restore starter deck (up to date)';
}

const plural = (n: number) => (n === 1 ? 'card' : 'cards');

/** What to say once it has run. */
export function starterRestoreNotice(plan: StarterRestorePlan): string {
  const parts: string[] = [];
  if (plan.add.length > 0) parts.push(`Added ${plan.add.length} ${plural(plan.add.length)}`);
  if (plan.repair.length > 0) {
    parts.push(
      `restored ${plan.repair.length} ${plural(plan.repair.length)} to the shipped version`,
    );
  }
  if (parts.length === 0) {
    return `Your copy of \u201c${STARTER_DECK_NAME}\u201d already matches the shipped one.`;
  }
  return `${parts.join(', ')} from \u201c${STARTER_DECK_NAME}\u201d.`;
}

/** How many cards the starter deck ships, without materializing any of them. */
export async function starterDeckSize(): Promise<number> {
  const { entries } = await loadStarterDeckData();
  return Object.values(entries).reduce((sum, rows) => sum + rows.length, 0);
}
