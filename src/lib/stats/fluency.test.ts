import type { StudyEvent } from '@/lib/analytics/events';
import { FLUENCY_MIN_READS, weeklyReadingSpeed } from './fluency';

const now = new Date('2026-11-12T12:00:00.000Z');
let n = 0;
const read = (
  daysAgo: number,
  revealLatencyMs: number,
  over: Partial<StudyEvent> = {},
): StudyEvent => ({
  id: `e${(n += 1)}`,
  sessionId: 's',
  seq: n,
  at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  kind: 'answer',
  mode: 'daily',
  exerciseType: 'rapid_recognition',
  applied: true,
  rating: 3,
  stateBefore: 2,
  repeatIndex: 0,
  revealLatencyMs,
  ...over,
});

describe('weeklyReadingSpeed', () => {
  it('gives the median reveal time of correct first looks at words in Review, week by week', () => {
    const events = [
      ...Array.from({ length: FLUENCY_MIN_READS }, (_, i) => read(2, 2000 + i * 1000)),
      ...Array.from({ length: FLUENCY_MIN_READS + 1 }, () => read(10, 2500)),
      // Too few in this week for a figure.
      read(20, 9000),
      // None of these is a read: a miss, a second look, a word still being learned,
      // a retry, a drill, and an answer with no reveal time.
      read(2, 100, { rating: 1 }),
      read(2, 100, { repeatIndex: 1 }),
      read(2, 100, { stateBefore: 1 }),
      read(2, 100, { applied: false }),
      read(2, 100, { exerciseType: 'cloze' }),
      read(2, 100, { revealLatencyMs: undefined }),
      read(400, 100),
      { ...read(2, 100), kind: 'intro' as const },
    ];
    const weeks = weeklyReadingSpeed(events, now, 4);
    expect(weeks).toHaveLength(4);
    expect(weeks[3]).toMatchObject({
      reads: FLUENCY_MIN_READS,
      medianSeconds: 6.5,
      fastShare: 0.1,
    });
    expect(weeks[2]).toMatchObject({
      reads: FLUENCY_MIN_READS + 1,
      medianSeconds: 2.5,
      fastShare: 1,
    });
    expect(weeks[1]).toMatchObject({ reads: 1, medianSeconds: null, fastShare: null });
    expect(weeks[0].reads).toBe(0);
    expect(weeks[0].start < weeks[3].start).toBe(true);
    expect(weeklyReadingSpeed([], now)).toHaveLength(8);
  });
});
