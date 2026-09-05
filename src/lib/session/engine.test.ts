import { createScheduler } from '@/lib/fsrs/scheduler';
import { mulberry32 } from '@/lib/util/random';
import { CardState, type VocabCard } from '@/types';
import { makeCard, makePool, reviewState } from '@/test/factories';
import { buildDrillExercises, selectDrillCards } from './drillPlan';
import { StudyEngine, drillRatingFor, summarizeResults } from './engine';
import { DEFAULT_SETTINGS } from '@/types';

const scheduler = createScheduler({ targetRetention: 0.9 }, { enableFuzz: false });

function clock(start = '2026-09-05T08:00:00.000Z') {
  let t = new Date(start).getTime();
  return {
    now: () => new Date(t),
    advance(ms: number) {
      t += ms;
    },
  };
}

function engineFor(
  pool: VocabCard[],
  queue: string[],
  options: Partial<ConstructorParameters<typeof StudyEngine>[0]> = {},
) {
  return new StudyEngine({
    pool,
    queue,
    scheduler,
    interleaveDrills: true,
    rng: mulberry32(1),
    ...options,
  });
}

describe('StudyEngine — recognition flow', () => {
  it('starts on the first queued card, hidden, with previews only after reveal', () => {
    const pool = makePool();
    const engine = engineFor(pool, [pool[0].id, pool[1].id]);
    const s = engine.snapshot();
    expect(s.status).toBe('active');
    expect(s.step).toEqual({ kind: 'card', cardId: pool[0].id });
    expect(s.revealed).toBe(false);
    expect(s.previews).toBeNull();
    expect(s.total).toBe(2);
    engine.reveal();
    const revealed = engine.snapshot();
    expect(revealed.revealed).toBe(true);
    expect(revealed.previews?.[1].intervalLabel).toMatch(/^\d+m$/);
    expect(revealed.revealLatencyMs).not.toBeNull();
    expect(revealed.previews?.[4].scheduledDays).toBeGreaterThanOrEqual(1);
  });

  it('returns the same snapshot object until something changes', () => {
    const pool = makePool();
    const engine = engineFor(pool, [pool[0].id]);
    expect(engine.snapshot()).toBe(engine.snapshot());
    engine.reveal();
    expect(engine.snapshot()).not.toBe(engine.snapshot().previews);
  });

  it('rating Easy graduates the card and completes the session', () => {
    const pool = makePool();
    const engine = engineFor(pool, [pool[0].id]);
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.reveal();
    const { card, log } = engine.rate(4);
    expect(card.fsrs.state).toBe(CardState.Review);
    expect(log.rating).toBe(4);
    expect(log.exerciseType).toBe('rapid_recognition');
    expect(log.cardId).toBe(pool[0].id);
    expect(log.stability).toBe(card.fsrs.stability);
    const s = engine.snapshot();
    expect(s.status).toBe('complete');
    expect(s.answered).toBe(1);
    expect(s.results).toHaveLength(1);
    expect(listener).toHaveBeenCalled();
    expect(engine.getCard(pool[0].id)?.fsrs.reps).toBe(1);
  });

  it('re-queues cards rated Again/Good that are still in learning', () => {
    const pool = makePool();
    const engine = engineFor(pool, [pool[0].id, pool[1].id]);
    engine.rate(1); // Again on card 0 → due in ~1 min → back of queue
    let s = engine.snapshot();
    expect(s.step).toEqual({ kind: 'card', cardId: pool[1].id });
    expect(s.total).toBe(3);
    expect(s.remaining).toBe(1);
    engine.rate(4);
    s = engine.snapshot();
    expect(s.step).toEqual({ kind: 'card', cardId: pool[0].id });
    engine.rate(4);
    expect(engine.snapshot().status).toBe('complete');
  });

  it('reuses the previewed schedule when rating shortly after reveal', () => {
    const pool = makePool();
    const c = clock();
    const engine = engineFor(pool, [pool[0].id], { now: c.now });
    engine.reveal();
    const previewDue = engine.snapshot().previews![3].due.toISOString();
    c.advance(5_000);
    const { card } = engine.rate(3);
    expect(card.fsrs.due).toBe(previewDue);
  });

  it('recomputes when the reveal is stale', () => {
    const pool = makePool();
    const c = clock();
    const engine = engineFor(pool, [pool[0].id], { now: c.now, previewReuseMs: 1000 });
    engine.reveal();
    const previewDue = new Date(engine.snapshot().previews![3].due).getTime();
    c.advance(5 * 60_000);
    const { card } = engine.rate(3);
    expect(new Date(card.fsrs.due).getTime()).toBeGreaterThan(previewDue);
  });

  it('records time spent per step and elapsed session time', () => {
    const pool = makePool();
    const c = clock();
    const engine = engineFor(pool, [pool[0].id], { now: c.now });
    c.advance(4_000);
    engine.reveal();
    c.advance(2_000);
    const { log } = engine.rate(4);
    expect(log.timeSpentMs).toBe(6_000);
    expect(engine.snapshot().elapsedMs).toBe(6_000);
  });

  it('throws when rating without an active card and can finish early', () => {
    const pool = makePool();
    const engine = engineFor(pool, [pool[0].id, pool[1].id]);
    engine.finish();
    expect(engine.snapshot().status).toBe('complete');
    expect(() => engine.rate(3)).toThrow();
    expect(engine.snapshot().step).toBeNull();
  });

  it('ignores queue ids that are not in the pool', () => {
    const pool = makePool();
    const engine = engineFor(pool, ['missing', pool[0].id]);
    expect(engine.snapshot().total).toBe(1);
  });
});

describe('StudyEngine — drill interleaving', () => {
  it('offers a drill after every 5th card; a card seen this session never gets the cloze', () => {
    const pool = makePool();
    const engine = engineFor(
      pool,
      pool.map((c) => c.id),
    );
    engine.rate(1); // first card: Again → learning, lapses 0 → drill candidate
    for (let i = 0; i < 4; i += 1) engine.rate(4);
    const s = engine.snapshot();
    expect(s.step?.kind).toBe('drill');
    if (s.step?.kind !== 'drill') throw new Error('expected drill');
    const exercise = s.step.exercise;
    // A cloze on a sentence revealed minutes ago would test the screen, not the reading.
    expect(exercise.type).not.toBe('cloze');
    const cardIds = exercise.type === 'realia_menu' ? exercise.cardIds : [exercise.cardId];
    expect(cardIds).toContain(pool[0].id);
    const reviews = engine.answerDrill([{ cardId: pool[0].id, correct: false }]);
    expect(reviews[0].log.exerciseType).toBe(exercise.type);
    expect(reviews[0].log.rating).toBe(1);
    expect(engine.snapshot().step?.kind).toBe('card');
    expect(engine.snapshot().answered).toBe(5);
  });

  it("reserves Fill the Blank for a learning card that is not part of today's session", () => {
    const pool = makePool();
    const outside = pool.find((c) => c.traditional === '團契')!;
    const learning = { ...outside, fsrs: { ...outside.fsrs, state: CardState.Learning } };
    const rest = pool.filter((c) => c.id !== outside.id);
    const engine = engineFor(
      [...rest, learning],
      rest.map((c) => c.id),
    );
    for (let i = 0; i < 5; i += 1) engine.rate(4);
    const s = engine.snapshot();
    expect(s.step?.kind).toBe('drill');
    if (s.step?.kind !== 'drill') throw new Error('expected drill');
    expect(s.step.exercise.type).toBe('cloze');
    if (s.step.exercise.type !== 'cloze') throw new Error('expected cloze');
    expect(s.step.exercise.cardId).toBe(outside.id);
  });

  it('does not drill when no card qualifies', () => {
    const pool = makePool();
    const engine = engineFor(
      pool,
      pool.slice(0, 6).map((c) => c.id),
    );
    for (let i = 0; i < 5; i += 1) engine.rate(4); // all graduate to Review
    expect(engine.snapshot().step?.kind).toBe('card');
  });

  it('never drills the same card twice in a session and rotates modality', () => {
    const pool = makePool();
    const engine = engineFor(
      pool,
      pool.map((c) => c.id),
    );
    engine.rate(1);
    engine.rate(1);
    for (let i = 0; i < 3; i += 1) engine.rate(4);
    const first = engine.snapshot().step;
    expect(first?.kind).toBe('drill');
    engine.skipDrill();
    // Answer 5 more (re-queued cards come back) to reach the next drill slot.
    let guard = 0;
    while (engine.snapshot().answered < 10 && engine.snapshot().status === 'active' && guard < 30) {
      const s = engine.snapshot();
      if (s.step?.kind === 'card') engine.rate(4);
      else engine.skipDrill();
      guard += 1;
    }
    const second = engine.snapshot().step;
    if (second?.kind === 'drill' && first?.kind === 'drill') {
      const firstId =
        'cardId' in first.exercise ? first.exercise.cardId : first.exercise.cardIds[0];
      const secondId =
        'cardId' in second.exercise ? second.exercise.cardId : second.exercise.cardIds[0];
      expect(secondId).not.toBe(firstId);
    }
  });
});

describe('StudyEngine — standalone drills', () => {
  it('runs pre-built drills in order and completes', () => {
    const pool = makePool();
    const selected = selectDrillCards(pool, DEFAULT_SETTINGS, {
      type: 'foil_discrimination',
      count: 2,
      now: new Date(),
      rng: mulberry32(2),
    });
    const drills = buildDrillExercises('foil_discrimination', selected, pool, mulberry32(3));
    expect(drills).toHaveLength(2);
    const engine = engineFor(pool, [], { drills, interleaveDrills: false });
    expect(engine.snapshot().drillsRemaining).toBe(1);
    const ex = engine.snapshot().step;
    if (ex?.kind !== 'drill' || ex.exercise.type !== 'foil_discrimination')
      throw new Error('expected foil');
    const [review] = engine.answerDrill([{ cardId: ex.exercise.cardId, correct: true }]);
    expect(review.log.rating).toBe(3);
    expect(review.log.exerciseType).toBe('foil_discrimination');
    engine.answerDrill([]);
    expect(engine.snapshot().status).toBe('complete');
  });
});

describe('StudyEngine — drill scoring (recognition ≠ recall)', () => {
  it('rates a miss Again, a hit Good only while learning, and leaves Review cards untouched', () => {
    const pool = makePool();
    const reviewCard = makeCard({
      traditional: '火鍋',
      fsrs: reviewState(),
      exampleSentenceTraditional: '冬天吃火鍋。',
      visualFoils: ['火渦'],
    });
    const all = [...pool, reviewCard];
    const drills = buildDrillExercises(
      'foil_discrimination',
      [reviewCard, pool[0]],
      all,
      mulberry32(9),
    );
    const engine = engineFor(all, [], { drills, interleaveDrills: false });
    expect(drillRatingFor(reviewCard, true)).toBeNull();
    expect(drillRatingFor(reviewCard, false)).toBe(1);
    expect(drillRatingFor(pool[0], true)).toBe(3);
    // Hit on the Review card: nothing persisted, but the answer is counted.
    const first = engine.answerDrill([{ cardId: reviewCard.id, correct: true }]);
    expect(first).toEqual([]);
    expect(engine.snapshot().results.at(-1)).toMatchObject({
      cardId: reviewCard.id,
      applied: false,
      rating: 3,
    });
    expect(engine.getCard(reviewCard.id)?.fsrs.reps).toBe(reviewCard.fsrs.reps);
    // Miss on a new card: persisted as Again with the state before the answer recorded.
    const second = engine.answerDrill([{ cardId: pool[0].id, correct: false }]);
    expect(second[0].log).toMatchObject({
      rating: 1,
      stateBefore: 0,
      exerciseType: 'foil_discrimination',
    });
    expect(engine.snapshot().results.at(-1)).toMatchObject({ applied: true, rating: 1 });
  });
});

describe('drillPlan', () => {
  it('prioritizes lapsed and learning cards, filters by type and domain', () => {
    const pool = makePool();
    const leech = makeCard({
      traditional: '藉口',
      domain: 'slang',
      fsrs: reviewState({ lapses: 4 }),
      exampleSentenceTraditional: '他有藉口。',
      visualFoils: ['籍口'],
    });
    const learning = makeCard({
      traditional: '崩潰',
      domain: 'slang',
      fsrs: reviewState({ state: 1 }),
      exampleSentenceTraditional: '我快崩潰了。',
      visualFoils: ['蹦潰'],
    });
    const all = [...pool, learning, leech];
    const picked = selectDrillCards(all, DEFAULT_SETTINGS, {
      type: 'cloze',
      count: 2,
      now: new Date(),
      rng: mulberry32(4),
    });
    expect(picked.map((c) => c.id)).toEqual([leech.id, learning.id]);
    const menu = selectDrillCards(all, DEFAULT_SETTINGS, {
      type: 'realia_menu',
      count: 10,
      now: new Date(),
    });
    expect(menu.every((c) => c.domain === 'food')).toBe(true);
    const church = selectDrillCards(all, DEFAULT_SETTINGS, {
      type: 'foil_discrimination',
      count: 10,
      now: new Date(),
      domain: 'church',
    });
    expect(church.every((c) => c.domain === 'church')).toBe(true);
    const only = selectDrillCards(all, DEFAULT_SETTINGS, {
      type: 'foil_discrimination',
      count: 10,
      now: new Date(),
      onlyIds: [leech.id],
    });
    expect(only.map((c) => c.id)).toEqual([leech.id]);
  });

  it('groups menu drills and pads lonely groups', () => {
    const pool = makePool();
    const food = pool.filter((c) => c.domain === 'food');
    const drills = buildDrillExercises('realia_menu', food, pool, mulberry32(5));
    expect(drills).toHaveLength(2);
    expect(drills.every((d) => d.type === 'realia_menu')).toBe(true);
    const single = buildDrillExercises('realia_menu', [food[0]], pool, mulberry32(6));
    if (single[0].type !== 'realia_menu') throw new Error('expected menu');
    expect(single[0].targets.length).toBe(2);
  });
});

describe('summarizeResults', () => {
  it('computes counts and retention', () => {
    expect(summarizeResults([])).toEqual({
      total: 0,
      correct: 0,
      uniqueCards: 0,
      firstTryCorrect: 0,
      weakCardIds: [],
      retention: null,
    });
    const summary = summarizeResults([
      {
        cardId: 'a',
        rating: 1,
        exerciseType: 'rapid_recognition',
        timeMs: 1,
        timestamp: 't',
        applied: true,
      },
      {
        cardId: 'a',
        rating: 3,
        exerciseType: 'rapid_recognition',
        timeMs: 1,
        timestamp: 't',
        applied: true,
      },
      { cardId: 'b', rating: 4, exerciseType: 'cloze', timeMs: 1, timestamp: 't', applied: true },
      { cardId: 'c', rating: 2, exerciseType: 'cloze', timeMs: 1, timestamp: 't', applied: true },
    ]);
    expect(summary).toEqual({
      total: 4,
      correct: 3,
      uniqueCards: 3,
      firstTryCorrect: 2,
      weakCardIds: ['a', 'c'],
      retention: 0.75,
    });
  });
});
