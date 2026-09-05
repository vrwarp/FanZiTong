import {
  MIN_CHECK_INTERVAL_MS,
  describeLastChecked,
  formatBuildStamp,
  shouldAutoCheck,
} from './updatePolicy';

describe('shouldAutoCheck', () => {
  const now = new Date('2026-09-05T12:00:00Z').getTime();

  it('always checks when nothing has been checked yet', () => {
    expect(shouldAutoCheck(null, now)).toBe(true);
  });

  it('throttles repeated foregrounding, then allows the next check', () => {
    expect(shouldAutoCheck(now - 1_000, now)).toBe(false);
    expect(shouldAutoCheck(now - (MIN_CHECK_INTERVAL_MS - 1), now)).toBe(false);
    expect(shouldAutoCheck(now - MIN_CHECK_INTERVAL_MS, now)).toBe(true);
    expect(shouldAutoCheck(now - 60 * 60_000, now)).toBe(true);
  });

  it('does not wedge when the device clock jumps backwards', () => {
    expect(shouldAutoCheck(now + 60_000, now)).toBe(false);
  });
});

describe('describeLastChecked', () => {
  const now = new Date('2026-09-05T12:00:00Z').getTime();

  it('reads as plain language at every age', () => {
    expect(describeLastChecked(null, now)).toBe('not checked yet');
    expect(describeLastChecked(now - 5_000, now)).toBe('checked just now');
    expect(describeLastChecked(now - 5 * 60_000, now)).toBe('checked 5m ago');
    expect(describeLastChecked(now - 3 * 3_600_000, now)).toBe('checked 3h ago');
    expect(describeLastChecked(now - 2 * 86_400_000, now)).toBe('checked 2d ago');
  });
});

describe('formatBuildStamp', () => {
  it('names the commit and the day it was built', () => {
    const stamp = formatBuildStamp('b28683b', '2026-09-05T21:46:00.000Z');
    expect(stamp).toContain('b28683b');
    expect(stamp).toContain('built');
    expect(stamp).toMatch(/2026/);
  });

  it('falls back to the id alone when the timestamp is unusable', () => {
    expect(formatBuildStamp('dev', 'not-a-date')).toBe('dev');
  });
});
