import { State } from 'ts-fsrs';
import { CardState } from '@/types';
import { reviewState } from '@/test/factories';
import {
  applyRating,
  clampRetention,
  createScheduler,
  fromFsrsCard,
  isDue,
  LEGACY_LEARNING_STEPS,
  newFsrsState,
  previewRatings,
  retrievability,
  STUDY_DAY_CLOCK,
  studyDayClock,
  toFsrsCard,
  UTC_CLOCK,
} from './scheduler';

const now = new Date('2026-09-05T08:00:00.000Z');
const scheduler = createScheduler({ targetRetention: 0.9 }, { enableFuzz: false });

describe('newFsrsState', () => {
  it('creates a New card due now', () => {
    const state = newFsrsState(now);
    expect(state.state).toBe(CardState.New);
    expect(state.reps).toBe(0);
    expect(state.lapses).toBe(0);
    expect(new Date(state.due).getTime()).toBe(now.getTime());
    expect(state.last_review).toBeUndefined();
  });
});

describe('toFsrsCard / fromFsrsCard', () => {
  it('round-trips state including optional fields', () => {
    const state = reviewState({ learning_steps: 1 });
    const card = toFsrsCard(state);
    expect(card.due).toBeInstanceOf(Date);
    expect(card.last_review).toBeInstanceOf(Date);
    expect(fromFsrsCard(card)).toEqual(state);
  });
  it('defaults missing learning_steps to 0', () => {
    const state = reviewState();
    delete state.learning_steps;
    expect(toFsrsCard(state).learning_steps).toBe(0);
  });
});

describe('applyRating (AC-1: strictly ts-fsrs)', () => {
  it('Again on a new card enters Learning within minutes', () => {
    const { next } = applyRating(scheduler, newFsrsState(now), 1, now);
    expect(next.state).toBe(State.Learning);
    expect(next.reps).toBe(1);
    const minutes = (new Date(next.due).getTime() - now.getTime()) / 60_000;
    expect(minutes).toBeGreaterThan(0);
    expect(minutes).toBeLessThan(10);
  });

  it('Easy on a new card graduates straight to Review with a multi-day interval', () => {
    const { next } = applyRating(scheduler, newFsrsState(now), 4, now);
    expect(next.state).toBe(State.Review);
    expect(next.scheduled_days).toBeGreaterThanOrEqual(1);
    expect(next.stability).toBeGreaterThan(0);
  });

  it('Good three times graduates from the learning steps; the third look is three hours out', () => {
    const first = applyRating(scheduler, newFsrsState(now), 3, now).next;
    expect(first.state).toBe(State.Learning);
    const later = new Date(now.getTime() + 10 * 60_000);
    const second = applyRating(scheduler, first, 3, later).next;
    expect(second.state).toBe(State.Learning);
    const hours = (new Date(second.due).getTime() - later.getTime()) / 3_600_000;
    expect(hours).toBeCloseTo(3, 1);
    expect(previewRatings(scheduler, first, later)[3].intervalLabel).toBe('3h');
    const evening = new Date(later.getTime() + 3 * 3_600_000);
    const third = applyRating(scheduler, second, 3, evening).next;
    expect(third.state).toBe(State.Review);
    expect(third.scheduled_days).toBeGreaterThanOrEqual(1);
  });

  it('can still schedule with the legacy steps, where Good twice graduates', () => {
    const legacy = createScheduler(
      { targetRetention: 0.9 },
      { enableFuzz: false, learningSteps: LEGACY_LEARNING_STEPS, relearningSteps: ['10m'] },
    );
    const first = applyRating(legacy, newFsrsState(now), 3, now).next;
    const second = applyRating(legacy, first, 3, new Date(now.getTime() + 10 * 60_000)).next;
    expect(second.state).toBe(State.Review);
  });

  it('Again on a Review card increments lapses and moves to Relearning', () => {
    const base = reviewState({ due: now.toISOString() });
    const { next } = applyRating(scheduler, base, 1, now);
    expect(next.state).toBe(State.Relearning);
    expect(next.lapses).toBe(1);
    expect(next.stability).toBeLessThan(base.stability);
  });

  it('matches ts-fsrs next() output exactly, on whichever clock it is told', () => {
    const base = reviewState({ due: now.toISOString() });
    const raw = applyRating(scheduler, base, 3, now, UTC_CLOCK).next;
    expect(raw).toEqual(fromFsrsCard(scheduler.next(toFsrsCard(base), now, 3).card));
    const ours = applyRating(scheduler, base, 3, now).next;
    const theirs = scheduler.next(
      toFsrsCard(base, STUDY_DAY_CLOCK),
      STUDY_DAY_CLOCK.toScheduler(now),
      3,
    ).card;
    expect(ours).toEqual(fromFsrsCard(theirs, STUDY_DAY_CLOCK));
    // The schedule itself lives in real time: due is a real instant after now.
    expect(new Date(ours.due).getTime()).toBeGreaterThan(now.getTime());
    expect(ours.last_review).toBe(now.toISOString());
  });

  it('orders intervals Again < Hard < Good < Easy on a review card', () => {
    const base = reviewState({ due: now.toISOString() });
    const p = previewRatings(scheduler, base, now);
    const due = (r: 1 | 2 | 3 | 4) => p[r].due.getTime();
    expect(due(1)).toBeLessThan(due(2));
    expect(due(2)).toBeLessThan(due(3));
    expect(due(3)).toBeLessThan(due(4));
    expect(p[1].intervalLabel).toMatch(/^(<10m|10m)$/);
    expect(p[3].intervalLabel).toMatch(/d|mo|y$/);
  });
});

describe('the study-day clock', () => {
  it('round-trips an instant and shifts it by the local offset and the day start', () => {
    const instant = new Date(2026, 8, 9, 0, 30);
    expect(STUDY_DAY_CLOCK.fromScheduler(STUDY_DAY_CLOCK.toScheduler(instant)).getTime()).toBe(
      instant.getTime(),
    );
    const shifted = STUDY_DAY_CLOCK.toScheduler(instant);
    // 00:30 local minus four hours is 20:30 the day before, on the scheduler's UTC date.
    expect(shifted.getUTCHours()).toBe(20);
    expect(shifted.getUTCMinutes()).toBe(30);
    expect(shifted.getUTCDate()).toBe(8);
    expect(UTC_CLOCK.toScheduler(instant).getTime()).toBe(instant.getTime());
  });

  it("counts a night's sleep as a day, and an hour across midnight as none", () => {
    const state = (lastReview: Date) =>
      reviewState({ stability: 0.3, last_review: lastReview.toISOString() });
    // 00:30 → 07:40 local: one study day passed, whatever UTC date either falls on.
    const overnight = applyRating(
      scheduler,
      state(new Date(2026, 8, 9, 0, 30)),
      3,
      new Date(2026, 8, 9, 7, 40),
    ).next;
    expect(overnight.elapsed_days).toBe(1);
    // 23:30 → 00:30: the same evening.
    const acrossMidnight = applyRating(
      scheduler,
      state(new Date(2026, 8, 9, 23, 30)),
      3,
      new Date(2026, 8, 10, 0, 30),
    ).next;
    expect(acrossMidnight.elapsed_days).toBe(0);
    // 03:59 → 04:01: the day has turned.
    const dawn = applyRating(
      scheduler,
      state(new Date(2026, 8, 10, 3, 59)),
      3,
      new Date(2026, 8, 10, 4, 1),
    ).next;
    expect(dawn.elapsed_days).toBe(1);
    // The overnight pass grows stability the way a day's recall does; the
    // same-evening one only nudges it.
    expect(overnight.stability).toBeGreaterThan(acrossMidnight.stability * 2);
  });

  it('lets a caller move the day start', () => {
    const midnight = studyDayClock(0);
    const late = new Date(2026, 8, 9, 23, 30);
    const early = new Date(2026, 8, 10, 0, 30);
    expect(midnight.toScheduler(early).getUTCDate()).not.toBe(
      midnight.toScheduler(late).getUTCDate(),
    );
  });
});

describe('retrievability', () => {
  it('is null for new cards and between 0 and 1 for reviewed cards', () => {
    expect(retrievability(scheduler, newFsrsState(now), now)).toBeNull();
    const r = retrievability(
      scheduler,
      reviewState({ last_review: '2026-09-01T00:00:00.000Z' }),
      now,
    );
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0);
    expect(r!).toBeLessThanOrEqual(1);
  });
  it('decays over time', () => {
    const state = reviewState({ last_review: '2026-09-01T00:00:00.000Z' });
    const soon = retrievability(scheduler, state, now)!;
    const later = retrievability(scheduler, state, new Date('2026-10-05T08:00:00.000Z'))!;
    expect(later).toBeLessThan(soon);
  });
});

describe('helpers', () => {
  it('clamps retention into a sane range', () => {
    expect(clampRetention(0.5)).toBe(0.7);
    expect(clampRetention(1)).toBe(0.99);
    expect(clampRetention(Number.NaN)).toBe(0.9);
  });
  it('isDue ignores new cards', () => {
    expect(isDue(newFsrsState(now), now)).toBe(false);
    expect(isDue(reviewState({ due: now.toISOString() }), now)).toBe(true);
    expect(isDue(reviewState({ due: '2027-01-01T00:00:00.000Z' }), now)).toBe(false);
  });
  it('respects target retention: lower retention gives longer intervals', () => {
    const lax = createScheduler({ targetRetention: 0.8 }, { enableFuzz: false });
    const base = reviewState({ due: now.toISOString() });
    const strict = applyRating(scheduler, base, 3, now).next;
    const loose = applyRating(lax, base, 3, now).next;
    expect(loose.scheduled_days).toBeGreaterThan(strict.scheduled_days);
  });
});
