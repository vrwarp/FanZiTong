/**
 * Recovering from a half-updated app.
 *
 * Every route is loaded as its own chunk, and activating a new service worker
 * drops the previous precache. A tab that was already open when a new version
 * shipped therefore asks for a chunk URL that no longer exists, and the import
 * rejects. Browsers word that failure differently, so match on the shapes they
 * all use.
 */
const CHUNK_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'failed to load module script',
  'unable to preload css',
];

export function isChunkLoadError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  if ((error as { name?: string }).name === 'ChunkLoadError') return true;
  const message = String((error as { message?: string }).message ?? error).toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/** One automatic reload per tab: a stale chunk must never become a reload loop. */
const RELOAD_FLAG = 'fzt-chunk-reload';

export function canAttemptChunkReload(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) !== '1';
  } catch {
    return false;
  }
}

export function markChunkReloadAttempted(): void {
  try {
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    /* storage unavailable; the fallback UI takes over */
  }
}

export function clearChunkReloadAttempt(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* ignore */
  }
}
