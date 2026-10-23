import { clearPausedSession, readPausedSession, savePausedSession } from './pausedSession';

const KEY = 'fzt-paused-session';
const noon = new Date(2026, 5, 10, 12, 0, 0);

describe('paused session', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the queue within the same study day', () => {
    savePausedSession(['a', 'b'], undefined, noon);
    const later = new Date(2026, 5, 10, 20, 0, 0);
    expect(readPausedSession(later)?.queue).toEqual(['a', 'b']);
  });

  it('does not survive the night, and clears the stale entry', () => {
    savePausedSession(['a'], undefined, noon);
    const nextDay = new Date(2026, 5, 11, 12, 0, 0);
    expect(readPausedSession(nextDay)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('treats the hours before the study-day boundary as the previous day', () => {
    savePausedSession(['a'], undefined, new Date(2026, 5, 10, 22, 0, 0));
    expect(readPausedSession(new Date(2026, 5, 11, 1, 0, 0))?.queue).toEqual(['a']);
  });

  it('saving an empty queue clears any paused session', () => {
    savePausedSession(['a'], undefined, noon);
    savePausedSession([], undefined, noon);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(readPausedSession(noon)).toBeNull();
  });

  it('discards an entry whose queue is empty or not a list', () => {
    localStorage.setItem(KEY, JSON.stringify({ day: '2026-06-10', queue: [], savedAt: 'x' }));
    expect(readPausedSession(noon)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();

    localStorage.setItem(KEY, JSON.stringify({ day: '2026-06-10', queue: 'a', savedAt: 'x' }));
    expect(readPausedSession(noon)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('reads nothing from corrupt storage instead of throwing', () => {
    localStorage.setItem(KEY, '{not json');
    expect(readPausedSession(noon)).toBeNull();
    localStorage.setItem(KEY, 'null');
    expect(readPausedSession(noon)).toBeNull();
  });

  it('clearPausedSession removes the entry', () => {
    savePausedSession(['a'], undefined, noon);
    clearPausedSession();
    expect(readPausedSession(noon)).toBeNull();
  });
});
