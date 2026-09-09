/**
 * The composition table, kept out of the app bundle.
 *
 * Nothing needs it until a card is revealed, a drill marks a wrong pick, or the
 * learner opens the leech list — never on a cold start, never on the dashboard.
 * Loading it eagerly cost 23 KB gzipped on the critical path of a phone-first
 * app, so it arrives as its own chunk on first use and stays for the session,
 * the same bargain the starter deck makes. The service worker precaches the
 * chunk, so an offline first run still gets it.
 *
 * `row` is deliberately synchronous and returns undefined before the chunk
 * lands: a breakdown is an enrichment, so the honest behaviour for one
 * millisecond of "not yet" is the same as for "nothing known" — show nothing.
 * `useEtymology` re-renders the moment it arrives.
 */
type Table = Record<string, string>;

let table: Table | null = null;
let pending: Promise<Table> | null = null;
const listeners = new Set<() => void>();

/** Fetch the table, once per session; callers share one download. */
export function loadEtymologyTable(): Promise<Table> {
  pending ??= import('@/data/etymology.json').then((module) => {
    table = module.default as Table;
    for (const listener of listeners) listener();
    return table;
  });
  return pending;
}

/** The raw "ids|radical|sound|match" row, or undefined if absent or not yet loaded. */
export function row(char: string): string | undefined {
  return table?.[char];
}

/** Snapshot for `useSyncExternalStore`: false until the chunk has landed. */
export function isLoaded(): boolean {
  return table !== null;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Drop the table so a test can exercise the not-yet-loaded state. */
export function resetEtymologyTableForTests(): void {
  table = null;
  pending = null;
}
