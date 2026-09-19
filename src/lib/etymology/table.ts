/**
 * The composition table and the dictionary, kept out of the app bundle.
 *
 * Nothing needs them until a card is revealed, a drill marks a wrong pick, or
 * the learner opens the leech list — never on a cold start, never on the
 * dashboard. Loading them eagerly cost tens of kilobytes on the critical path
 * of a phone-first app, so they arrive as their own chunks on first use and
 * stay for the session, the same bargain the starter deck makes. The service
 * worker precaches both, so an offline first run still gets them.
 *
 * `row`, `dictionaryEntry` and `wordSenses` are deliberately synchronous and
 * return undefined before the chunks land: a breakdown or a gloss is an
 * enrichment, so the honest behaviour for one millisecond of "not yet" is the
 * same as for "nothing known" — show nothing. `useEtymology` re-renders the
 * moment they arrive.
 */
type Table = Record<string, string>;
interface Dictionary {
  /** "pinyin|gloss" per character. */
  chars: Record<string, string>;
  /** The senses a deck word has besides the one its card teaches. */
  words: Record<string, string[]>;
}

let table: Table | null = null;
let dictionary: Dictionary | null = null;
let pending: Promise<Table> | null = null;
const listeners = new Set<() => void>();

/** Fetch the table and the dictionary, once per session; callers share one download. */
export function loadEtymologyTable(): Promise<Table> {
  pending ??= Promise.all([import('@/data/etymology.json'), import('@/data/dictionary.json')])
    .then(([composition, dict]) => {
      table = composition.default as Table;
      dictionary = dict.default as Dictionary;
      for (const listener of listeners) listener();
      return table;
    })
    .catch((err: unknown) => {
      // A failed fetch must not become the cached answer: a tab that was
      // offline for one moment would otherwise stay without its glosses.
      pending = null;
      throw err;
    });
  return pending;
}

/** The raw "ids|radical|sound|match" row, or undefined if absent or not yet loaded. */
export function row(char: string): string | undefined {
  return table?.[char];
}

export interface DictionaryEntry {
  pinyin: string;
  gloss: string;
}

/** A character's reading and one-line gloss, or undefined if absent or not yet loaded. */
export function dictionaryEntry(char: string): DictionaryEntry | undefined {
  const raw = dictionary?.chars[char];
  if (!raw) return undefined;
  const [pinyin = '', gloss = ''] = raw.split('|');
  return { pinyin, gloss };
}

/** The other senses of a deck word, or undefined if it has none or the dictionary is not yet loaded. */
export function wordSenses(word: string): readonly string[] | undefined {
  return dictionary?.words[word];
}

/** Snapshot for `useSyncExternalStore`: false until the chunks have landed. */
export function isLoaded(): boolean {
  return table !== null && dictionary !== null;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Drop the tables so a test can exercise the not-yet-loaded state. */
export function resetEtymologyTableForTests(): void {
  table = null;
  dictionary = null;
  pending = null;
}
