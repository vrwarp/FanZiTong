import type { DomainCategory, VocabCard } from '@/types';
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
 * [traditional, pinyin, definition, tags, sentence, sentence pinyin, translation, foils, variants?]
 * `tags`, `foils` and `variants` are "|"-delimited. Foils are visually
 * confusable look-alikes (radical/component swaps, near-homographs) for §5.4
 * drills. Variants are accepted real-world spellings (滷肉飯 → 魯肉飯) that are
 * shown as "also written" and never used as wrong answers.
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
];

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
  pending ??= import('./starterDeck.json').then(
    (m) => (m.default ?? m) as unknown as StarterDeckData,
  );
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
    ] of data.entries[domain]) {
      // Stagger createdAt so the new-card queue keeps authoring order.
      const createdAt = new Date(now.getTime() + index).toISOString();
      index += 1;
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
        visualFoils: foils.split('|').filter(Boolean),
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
 * How the "restore starter deck" control should read.
 *
 * `missing` is null until the rows have loaded, and that is not the same as
 * zero. The two were conflated once and the button said "complete" before it
 * had looked — a claim made out of missing data, and a permanent one if the
 * chunk never arrives. Not knowing yet is its own state, and it says nothing.
 */
export function starterRestoreLabel(missing: number | null): string {
  if (missing === null) return 'Restore starter deck';
  return missing > 0 ? `Restore starter deck (adds ${missing})` : 'Restore starter deck (complete)';
}

/** How many cards the starter deck ships, without materializing any of them. */
export async function starterDeckSize(): Promise<number> {
  const { entries } = await loadStarterDeckData();
  return Object.values(entries).reduce((sum, rows) => sum + rows.length, 0);
}
