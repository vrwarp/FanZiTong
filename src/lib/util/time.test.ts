import {
  addDays,
  dayKey,
  formatDuration,
  formatInterval,
  formatRelativeDue,
  formatSessionTime,
  isSameLocalDay,
  startOfDay,
} from './time';

describe('formatInterval', () => {
  const now = new Date('2026-09-05T08:00:00Z');
  it('formats learning-step and day-scale intervals', () => {
    expect(formatInterval(now, new Date(now.getTime() + 20_000))).toBe('<1m');
    expect(formatInterval(now, new Date(now.getTime() + 60_000))).toBe('1m');
    expect(formatInterval(now, new Date(now.getTime() + 6 * 60_000))).toBe('6m');
    expect(formatInterval(now, new Date(now.getTime() + 25 * 60_000))).toBe('25m');
    expect(formatInterval(now, new Date(now.getTime() + 3 * 3_600_000))).toBe('3h');
    expect(formatInterval(now, addDays(now, 1))).toBe('1d');
    expect(formatInterval(now, addDays(now, 12))).toBe('12d');
    expect(formatInterval(now, addDays(now, 61))).toBe('2mo');
    expect(formatInterval(now, addDays(now, 548))).toBe('1.5y');
    expect(formatInterval(now, addDays(now, 3650))).toBe('10y');
  });
  it('never goes negative', () => {
    expect(formatInterval(now, new Date(now.getTime() - 1000))).toBe('<1m');
  });
});

describe('day helpers', () => {
  it('computes local day keys and day boundaries', () => {
    const d = new Date(2026, 8, 5, 13, 30);
    expect(dayKey(d)).toBe('2026-09-05');
    expect(startOfDay(d).getHours()).toBe(0);
    expect(isSameLocalDay(d, new Date(2026, 8, 5, 23, 59))).toBe(true);
    expect(isSameLocalDay(d, new Date(2026, 8, 6, 0, 0))).toBe(false);
    expect(dayKey(addDays(d, 27))).toBe('2026-10-02');
  });
  it('formats durations and relative due', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(65_000)).toBe('1m 05s');
    expect(formatSessionTime(12_000)).toBe('< 1 min');
    expect(formatSessionTime(65_000)).toBe('1 min');
    expect(formatSessionTime(11 * 60_000 + 40_000)).toBe('12 min');
    const now = new Date('2026-09-05T08:00:00Z');
    expect(formatRelativeDue(new Date(now.getTime() - 1), now)).toBe('due now');
    expect(formatRelativeDue(addDays(now, 3), now)).toBe('in 3d');
  });
});

describe('formatInterval rounding', () => {
  it('rounds up to the next unit instead of printing 60m or 24h', () => {
    const now = new Date('2026-09-05T08:00:00Z');
    expect(formatInterval(now, new Date(now.getTime() + 59.7 * 60_000))).toBe('1h');
    expect(formatInterval(now, new Date(now.getTime() + 23.7 * 3_600_000))).toBe('1d');
    expect(formatInterval(now, new Date(now.getTime() + 2 * 86_400_000))).toBe('2d');
  });
});
