import {
  canAttemptChunkReload,
  clearChunkReloadAttempt,
  isChunkLoadError,
  markChunkReloadAttempted,
} from './chunkErrors';

describe('isChunkLoadError', () => {
  it('recognises how each browser words a missing chunk', () => {
    const messages = [
      'Failed to fetch dynamically imported module: https://example.com/assets/StatsPage-a1b2.js',
      'error loading dynamically imported module',
      'Importing a module script failed.',
      'Failed to load module script: MIME type check failed',
      'Unable to preload CSS for /assets/index-9f8e.css',
    ];
    for (const message of messages) expect(isChunkLoadError(new Error(message))).toBe(true);
    const named = new Error('boom');
    named.name = 'ChunkLoadError';
    expect(isChunkLoadError(named)).toBe(true);
  });

  it('leaves ordinary application errors alone', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(new TypeError('card.fsrs is not an object'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });

  it('handles a thrown string', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(true);
    expect(isChunkLoadError('nope')).toBe(false);
  });
});

describe('the one-reload-per-tab guard', () => {
  beforeEach(() => clearChunkReloadAttempt());

  it('permits exactly one automatic reload, until cleared by a real update', () => {
    expect(canAttemptChunkReload()).toBe(true);
    markChunkReloadAttempted();
    expect(canAttemptChunkReload()).toBe(false);
    clearChunkReloadAttempt();
    expect(canAttemptChunkReload()).toBe(true);
  });
});
