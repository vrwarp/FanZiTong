import { createScheduler } from '@/lib/fsrs/scheduler';
import type { StudyEvent } from '@/lib/analytics/events';
import { MAX_SESSION_REQUEUES, MIN_RETRY_GAP_MS } from '@/lib/queue/session';
import { mulberry32 } from '@/lib/util/random';
import { CardState, type VocabCard } from '@/types';
import { makeCard, makePool, reviewState } from '@/test/factories';
import { buildDrillExercises, selectDrillCards } from './drillPlan';
import type { DrillExercise } from './engine';
import {
  MAX_COUNTED_ANSWER_MS,
  StudyEngine,
  describeDrillOutcome,
  drillRatingFor,
  summarizeResults,
} from './engine';
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
    // The gap between two looks at one card has its own tests; everything
    // else runs on a still clock and wants the card straight back.
    retryGapMs: 0,
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
    const { card, log } = engine.rate(4)!;
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

  it('stops re-queueing one card once it has had its turns', () => {
    // Answering Again drives the interval to the floor, which is always inside
    // the learn-ahead window: without a cap the card returns forever.
    const pool = makePool();
    const engine = engineFor(pool, [pool[0].id]);
    for (let i = 0; i < MAX_SESSION_REQUEUES; i += 1) {
      expect(engine.snapshot().step).toEqual({ kind: 'card', cardId: pool[0].id });
      engine.rate(1);
    }
    // The last re-queue is spent on this answer; nothing follows it.
    expect(engine.snapshot().step).toEqual({ kind: 'card', cardId: pool[0].id });
    engine.rate(1);
    expect(engine.snapshot().status).toBe('complete');
    // Four looks, one verdict: only the first Again of the day reaches FSRS.
    expect(engine.getCard(pool[0].id)?.fsrs.reps).toBe(1);
    expect(engine.snapshot().results.filter((r) => r.retry)).toHaveLength(MAX_SESSION_REQUEUES);
  });

  it('does not hand a resumed session a fresh set of re-queues', () => {
    const pool = makePool();
    const first = engineFor(pool, [pool[0].id]);
    first.rate(1);
    const progress = first.serialize();
    expect(progress.requeues?.[pool[0].id]).toBe(1);

    const resumed = engineFor(pool, first.remainingCardIds(), { restore: progress });
    for (let i = 0; i < MAX_SESSION_REQUEUES - 1; i += 1) resumed.rate(1);
    expect(resumed.snapshot().step).toEqual({ kind: 'card', cardId: pool[0].id });
    resumed.rate(1);
    expect(resumed.snapshot().status).toBe('complete');
  });

  it('reuses the previewed schedule when rating shortly after reveal', () => {
    const pool = makePool();
    const c = clock();
    const engine = engineFor(pool, [pool[0].id], { now: c.now });
    engine.reveal();
    const previewDue = engine.snapshot().previews![3].due.toISOString();
    c.advance(5_000);
    const { card } = engine.rate(3)!;
    expect(card.fsrs.due).toBe(previewDue);
  });

  it('recomputes when the reveal is stale', () => {
    const pool = makePool();
    const c = clock();
    const engine = engineFor(pool, [pool[0].id], { now: c.now, previewReuseMs: 1000 });
    engine.reveal();
    const previewDue = new Date(engine.snapshot().previews![3].due).getTime();
    c.advance(5 * 60_000);
    const { card } = engine.rate(3)!;
    expect(new Date(card.fsrs.due).getTime()).toBeGreaterThan(previewDue);
  });

  it('records time spent per step and elapsed session time', () => {
    const pool = makePool();
    const c = clock();
    const engine = engineFor(pool, [pool[0].id], { now: c.now });
    c.advance(4_000);
    engine.reveal();
    c.advance(2_000);
    const { log } = engine.rate(4)!;
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
    // The card was knocked down minutes ago, so this miss is practice: the
    // drill is recorded with its modality, and nothing is written for FSRS.
    const reviews = engine.answerDrill([{ cardId: pool[0].id, correct: false }]);
    expect(reviews).toEqual([]);
    expect(engine.snapshot().results.at(-1)).toMatchObject({
      cardId: pool[0].id,
      exerciseType: exercise.type,
      rating: 1,
      applied: false,
      retry: true,
    });
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

describe('StudyEngine — one word, one drill', () => {
  const lapsed = (traditional: string, extra: Partial<VocabCard> = {}) =>
    makeCard({
      traditional,
      domain: 'food',
      fsrs: reviewState({ lapses: 1, due: '2026-09-05T07:00:00.000Z' }),
      exampleSentenceTraditional: `我要一碗${traditional}。`,
      ...extra,
    });

  it('counts a studied dish on a slip as drilled, and never drills it again that session', () => {
    const pool = makePool();
    const engine = engineFor(
      pool,
      pool.map((c) => c.id),
    );
    // Three food words knocked down, two others read: the fifth answer brings a slip.
    engine.rate(1); // 滷肉飯
    engine.rate(1); // 牛肉麵
    engine.rate(1); // 貢丸湯
    engine.rate(4); // 地瓜葉
    engine.rate(4); // 團契
    const first = engine.snapshot().step;
    if (first?.kind !== 'drill' || first.exercise.type !== 'realia_menu') {
      throw new Error('expected a slip');
    }
    const onSlip = first.exercise.cardIds.filter((id) => pool.some((c) => c.id === id));
    expect(onSlip.length).toBeGreaterThan(1);
    engine.answerDrill(onSlip.map((cardId) => ({ cardId, correct: true })));
    // Run the session out; no later drill may ask about a dish that was on that slip.
    const later: DrillExercise[] = [];
    let guard = 0;
    while (engine.snapshot().status === 'active' && guard < 60) {
      const s = engine.snapshot();
      if (s.step?.kind === 'card') engine.rate(4);
      else if (s.step?.kind === 'drill') {
        later.push(s.step.exercise);
        engine.skipDrill();
      } else engine.tick();
      guard += 1;
    }
    for (const exercise of later) {
      const ids = exercise.type === 'realia_menu' ? exercise.cardIds : [exercise.cardId];
      for (const id of onSlip) expect(ids).not.toContain(id);
    }
  });

  it("does not put a slip's dish into the very next drill, even to fill a gap", () => {
    // Two lapsed dishes read correctly (not re-queued) and three new words
    // knocked down (waiting out their minute): the fifth answer brings a slip
    // on one lapsed dish with the other beside it. Before, the gap after the
    // slip was filled with a drill on that very neighbour.
    const pool = makePool();
    const x = lapsed('餛飩湯');
    const y = lapsed('貢丸湯', { visualFoils: ['貞丸湯'] });
    const fresh = pool.filter((c) => c.domain !== 'food').slice(0, 3);
    const all = [...pool, x, y];
    const c = clock();
    const engine = engineFor(all, [x.id, y.id, ...fresh.map((f) => f.id)], {
      now: c.now,
      retryGapMs: 60_000,
    });
    engine.rate(3); // 餛飩湯: read
    c.advance(1000);
    engine.rate(3); // 貢丸湯: read
    for (const _ of fresh) {
      c.advance(1000);
      engine.rate(1);
    }
    const first = engine.snapshot().step;
    if (first?.kind !== 'drill' || first.exercise.type !== 'realia_menu') {
      throw new Error('expected a slip');
    }
    expect(first.exercise.cardIds).toContain(x.id);
    expect(first.exercise.cardIds).toContain(y.id);
    // Nothing still queued for its first look may be printed on the slip.
    for (const f of fresh) expect(first.exercise.cardIds).not.toContain(f.id);
    engine.answerDrill([
      { cardId: x.id, correct: true },
      { cardId: y.id, correct: true },
    ]);
    // The three new words are inside their minute and the only other seen
    // dish was on the slip: the session waits rather than drill it.
    const next = engine.snapshot().step;
    expect(next?.kind).toBe('wait');
  });

  it('keeps the previous drill and the queue out of a cloze', () => {
    const pool = makePool();
    const outside = makeCard({
      traditional: '見證',
      domain: 'church',
      fsrs: reviewState({ state: CardState.Learning, stability: 0.3 }),
      exampleSentenceTraditional: '她在聚會裡分享見證。',
    });
    const tuanQi = pool.find((c) => c.traditional === '團契')!;
    const daoGao = pool.find((c) => c.traditional === '禱告')!;
    const all = [...pool, outside];
    // 團契 is drilled first (a pre-built foil); 禱告 stays queued and unmet
    // while the fifth answer brings a cloze on the outside learning card.
    const queue = [...pool.filter((c) => c.domain === 'food'), pool[6], daoGao].map((c) => c.id);
    const engine = engineFor(all, queue, {
      drills: buildDrillExercises('foil_discrimination', [tuanQi], all, mulberry32(3)),
    });
    const first = engine.snapshot().step;
    if (first?.kind !== 'drill' || first.exercise.type !== 'foil_discrimination') {
      throw new Error('expected the foil drill');
    }
    engine.skipDrill();
    for (let i = 0; i < 5; i += 1) engine.rate(4);
    const cloze = engine.snapshot().step;
    if (cloze?.kind !== 'drill' || cloze.exercise.type !== 'cloze') {
      throw new Error('expected a cloze');
    }
    expect(cloze.exercise.cardId).toBe(outside.id);
    expect(engine.remainingCardIds()).toContain(daoGao.id);
    // The only two church words in the deck are the one just drilled and the
    // one not yet met: the cloze fills its options from elsewhere.
    expect(cloze.exercise.options).not.toContain('團契');
    expect(cloze.exercise.options).not.toContain('禱告');
    expect(cloze.exercise.options).toContain('見證');
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
      // Two positions, so the set can be crossed rather than starred.
      visualFoils: ['火渦', '伙鍋'],
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

describe('StudyEngine — study events', () => {
  it('brackets the session and records every answer, with its repeat index', () => {
    const pool = makePool();
    const events: StudyEvent[] = [];
    const engine = engineFor(pool, [pool[0].id, pool[1].id], {
      sessionId: 'session-1',
      onEvent: (e) => events.push(e),
    });
    engine.rate(1);
    engine.rate(4);
    engine.rate(4);

    expect(events[0]).toMatchObject({ kind: 'session_start', planned: 2, mode: 'daily' });
    expect(events.every((e) => e.sessionId === 'session-1')).toBe(true);
    expect(events.map((e) => e.seq)).toEqual([0, 1, 2, 3, 4]);
    const answers = events.filter((e) => e.kind === 'answer');
    expect(answers.map((e) => e.cardId)).toEqual([pool[0].id, pool[1].id, pool[0].id]);
    expect(answers.map((e) => e.repeatIndex)).toEqual([0, 0, 1]);
    expect(answers[0]).toMatchObject({ applied: true, correct: false, stateBefore: CardState.New });
    expect(answers[0].stabilityAfter).toBeGreaterThan(0);
    const end = events.at(-1)!;
    expect(end).toMatchObject({ kind: 'session_end', completed: true, answered: 3 });
  });

  it('records the drill answers FSRS ignores, which never reach the review log', () => {
    const pool = makePool();
    const card = { ...pool[0], fsrs: reviewState({ stability: 20 }) };
    const rest = pool.slice(1);
    const events: StudyEvent[] = [];
    const drills = buildDrillExercises('foil_discrimination', [card], [card, ...rest]);
    const engine = new StudyEngine({
      pool: [card, ...rest],
      queue: [],
      drills,
      scheduler,
      interleaveDrills: false,
      drillType: 'foil_discrimination',
      onEvent: (e) => events.push(e),
    });
    const persisted = engine.answerDrill([
      { cardId: card.id, correct: true, misses: 0, picked: undefined },
    ]);
    // A hit on a card already in Review changes nothing, so nothing is persisted…
    expect(persisted).toHaveLength(0);
    // …but the event log still knows the learner read it correctly.
    const answer = events.find((e) => e.kind === 'answer')!;
    expect(answer).toMatchObject({
      applied: false,
      correct: true,
      cardId: card.id,
      exerciseType: 'foil_discrimination',
      drillType: 'foil_discrimination',
      mode: 'drill',
    });
  });

  it('records a skipped drill and an abandoned session', () => {
    const pool = makePool();
    const events: StudyEvent[] = [];
    const drills = buildDrillExercises('foil_discrimination', [pool[0]], pool);
    const engine = new StudyEngine({
      pool,
      queue: [],
      drills,
      scheduler,
      interleaveDrills: false,
      onEvent: (e) => events.push(e),
    });
    engine.skipDrill();
    engine.finish();
    expect(events.map((e) => e.kind)).toContain('drill_skip');
    // The queue emptied on its own before finish() was called.
    expect(events.filter((e) => e.kind === 'session_end')).toHaveLength(1);
  });

  it('stays silent when no sink is attached', () => {
    const pool = makePool();
    const engine = engineFor(pool, [pool[0].id]);
    expect(() => engine.rate(4)).not.toThrow();
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

  it("never offers one selected word as an option in another selected word's cloze", () => {
    const pool = makePool();
    const church = pool.filter((c) => c.domain === 'church');
    expect(church.length).toBe(2);
    const drills = buildDrillExercises('cloze', church, pool, mulberry32(7));
    for (const drill of drills) {
      if (drill.type !== 'cloze') throw new Error('expected cloze');
      for (const other of church) {
        if (other.id !== drill.cardId) expect(drill.options).not.toContain(other.traditional);
      }
    }
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
      retries: 0,
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
      retries: 0,
      retention: 0.75,
    });
  });

  it('counts a retry as a look at the word, but not a slip companion', () => {
    const summary = summarizeResults([
      {
        cardId: 'a',
        rating: 1,
        exerciseType: 'rapid_recognition',
        timeMs: 1,
        timestamp: 't',
        applied: false,
        retry: true,
      },
      {
        cardId: 'b',
        rating: 3,
        exerciseType: 'realia_menu',
        timeMs: 1,
        timestamp: 't',
        applied: false,
      },
    ]);
    expect(summary.uniqueCards).toBe(1);
    expect(summary.retries).toBe(1);
    expect(summary.weakCardIds).toEqual(['a']);
  });
});

describe('StudyEngine — standalone drills', () => {
  it('asks a missed item once more before the end, and no more than once', () => {
    const pool = makePool();
    const card = pool.find((c) => c.traditional === '團契')!;
    const drills = buildDrillExercises('foil_discrimination', [card], pool, mulberry32(3));
    const engine = new StudyEngine({
      pool,
      queue: [],
      drills,
      scheduler,
      interleaveDrills: false,
      rng: mulberry32(1),
    });
    expect(engine.snapshot().drillTotal).toBe(1);
    engine.answerDrill([{ cardId: card.id, correct: false }]);
    let s = engine.snapshot();
    expect(s.requeued).toBe(1);
    expect(s.drillTotal).toBe(2);
    expect(s.step?.kind).toBe('drill');
    engine.answerDrill([{ cardId: card.id, correct: false }]);
    s = engine.snapshot();
    expect(s.requeued).toBe(1);
    expect(s.status).toBe('complete');
  });
});

describe('StudyEngine — a word is knocked down once a day', () => {
  it('charges the first Again and treats every later miss that day as a retry', () => {
    const pool = makePool();
    const events: StudyEvent[] = [];
    const c = clock();
    const engine = engineFor(pool, [pool[0].id], { now: c.now, onEvent: (e) => events.push(e) });
    const first = engine.rate(1)!;
    expect(first.log.rating).toBe(1);
    expect(first.card.lastAgainAt).toBe(c.now().toISOString());
    const afterFirst = engine.getCard(pool[0].id)!.fsrs;

    c.advance(90_000);
    expect(engine.rate(1)).toBeNull(); // Again again: a retry
    c.advance(90_000);
    expect(engine.rate(2)).toBeNull(); // Hard after an Again: still a retry
    const card = engine.getCard(pool[0].id)!;
    expect(card.fsrs).toEqual(afterFirst);
    expect(card.fsrs.reps).toBe(1);
    expect(card.fsrs.difficulty).toBe(afterFirst.difficulty);

    const results = engine.snapshot().results;
    expect(results.map((r) => r.retry ?? false)).toEqual([false, true, true]);
    const answers = events.filter((e) => e.kind === 'answer');
    expect(answers.map((e) => e.retry ?? false)).toEqual([false, true, true]);
    expect(answers[1]).toMatchObject({
      applied: false,
      rating: 1,
      correct: false,
      repeatIndex: 1,
      stabilityAfter: afterFirst.stability,
    });
    // The card still comes back: a retry is practice, not a dismissal.
    expect(engine.snapshot().step).toEqual({ kind: 'card', cardId: pool[0].id });
  });

  it('lets a pass after a retry count, so the card can climb out of its step', () => {
    const pool = makePool();
    const c = clock();
    const engine = engineFor(pool, [pool[0].id], { now: c.now });
    engine.rate(1);
    c.advance(90_000);
    engine.rate(1);
    c.advance(90_000);
    const passed = engine.rate(3)!;
    expect(passed.log.rating).toBe(3);
    expect(passed.card.fsrs.reps).toBe(2);
    expect(passed.card.fsrs.stability).toBeGreaterThan(0.212);
    expect(passed.card.lastAgainAt).toBeDefined();
  });

  it('charges an Again on a card last knocked down on an earlier day', () => {
    const pool = makePool();
    const yesterday = makeCard({
      id: 'yesterday',
      fsrs: reviewState({ state: 1, stability: 0.2, due: '2026-09-04T09:00:00.000Z' }),
      lastAgainAt: '2026-09-04T09:00:00.000Z',
    });
    const c = clock('2026-09-05T08:00:00.000Z');
    const engine = engineFor([...pool, yesterday], ['yesterday'], { now: c.now });
    const review = engine.rate(1);
    expect(review).not.toBeNull();
    expect(review!.log.rating).toBe(1);
    expect(review!.card.lastAgainAt).toBe(c.now().toISOString());
  });

  it('records drill answers on a word knocked down today as practice', () => {
    const pool = makePool();
    const card = makeCard({
      traditional: '火鍋',
      fsrs: reviewState({ state: 3, stability: 0.3, lapses: 1 }),
      exampleSentenceTraditional: '冬天吃火鍋。',
      visualFoils: ['火渦', '伙鍋'],
      lastAgainAt: '2026-09-05T07:00:00.000Z',
    });
    const all = [...pool, card];
    const drills = buildDrillExercises('foil_discrimination', [card, card], all, mulberry32(9));
    const events: StudyEvent[] = [];
    const c = clock('2026-09-05T08:00:00.000Z');
    const engine = engineFor(all, [], {
      drills,
      interleaveDrills: false,
      now: c.now,
      onEvent: (e) => events.push(e),
    });
    expect(engine.answerDrill([{ cardId: card.id, correct: false }])).toEqual([]);
    expect(engine.answerDrill([{ cardId: card.id, correct: true }])).toEqual([]);
    expect(engine.getCard(card.id)?.fsrs).toEqual(card.fsrs);
    const answers = events.filter((e) => e.kind === 'answer');
    expect(answers.map((e) => e.retry)).toEqual([true, true]);
    expect(answers.map((e) => e.rating)).toEqual([1, 3]);
    expect(describeDrillOutcome(card, false, true, c.now())).toMatch(/^Practice/);
    expect(describeDrillOutcome(card, true, true, c.now())).toMatch(/^Practice/);
    // The same card on another day is graded as usual.
    const tomorrow = new Date('2026-09-06T08:00:00.000Z');
    expect(describeDrillOutcome(card, false, true, tomorrow)).toMatch(/^Again/);
  });
});

describe('StudyEngine — a card waits its turn', () => {
  it('serves another card first and holds when nothing is ready', () => {
    const pool = makePool();
    const c = clock();
    const engine = engineFor(pool, [pool[0].id, pool[1].id], {
      now: c.now,
      retryGapMs: MIN_RETRY_GAP_MS,
    });
    engine.rate(1); // card 0 → back of the queue
    c.advance(5_000);
    expect(engine.snapshot().step).toEqual({ kind: 'card', cardId: pool[1].id });
    engine.rate(4);
    // Card 0 was answered five seconds ago: the session waits rather than show it.
    let s = engine.snapshot();
    expect(s.step).toEqual({
      kind: 'wait',
      until: c.now().getTime() - 5_000 + MIN_RETRY_GAP_MS,
      waiting: 1,
    });
    expect(s.total).toBe(3);
    expect(s.remaining).toBe(1);
    engine.tick(); // too early: still waiting
    expect(engine.snapshot().step?.kind).toBe('wait');
    c.advance(MIN_RETRY_GAP_MS);
    engine.tick();
    s = engine.snapshot();
    expect(s.step).toEqual({ kind: 'card', cardId: pool[0].id });
    expect(engine.rate(3)).not.toBeNull();
  });

  it('carries the gap across a pause', () => {
    const pool = makePool();
    const c = clock();
    const first = engineFor(pool, [pool[0].id], { now: c.now, retryGapMs: MIN_RETRY_GAP_MS });
    first.rate(1);
    const progress = first.serialize();
    expect(progress.answeredAt?.[pool[0].id]).toBe(c.now().getTime());
    c.advance(10_000);
    const resumed = engineFor(pool, first.remainingCardIds(), {
      now: c.now,
      retryGapMs: MIN_RETRY_GAP_MS,
      restore: progress,
    });
    expect(resumed.snapshot().step?.kind).toBe('wait');
    c.advance(MIN_RETRY_GAP_MS);
    resumed.tick();
    expect(resumed.snapshot().step).toEqual({ kind: 'card', cardId: pool[0].id });
  });

  it('fills the gap with a drill on another word when it can', () => {
    const pool = makePool();
    // A word still being learned from an earlier day, not part of today's queue.
    const learning = makeCard({
      id: 'learning',
      traditional: '滷味',
      pinyin: 'lǔ wèi',
      definition: 'Braised snacks',
      exampleSentenceTraditional: '晚上去買滷味。',
      fsrs: reviewState({ state: 1, stability: 0.3 }),
    });
    const c = clock();
    const engine = engineFor([...pool, learning], [pool[0].id], {
      now: c.now,
      retryGapMs: MIN_RETRY_GAP_MS,
    });
    engine.rate(1);
    const s = engine.snapshot();
    if (s.step?.kind !== 'drill' || s.step.exercise.type !== 'cloze') {
      throw new Error(`expected a cloze drill, got ${JSON.stringify(s.step?.kind)}`);
    }
    expect(s.step.exercise.cardId).toBe('learning');
  });

  it('still drills a just-failed card on the fifth answer: a drill is not a second look', () => {
    const pool = makePool();
    const c = clock();
    const engine = engineFor(
      pool,
      pool.map((card) => card.id),
      { now: c.now, retryGapMs: MIN_RETRY_GAP_MS },
    );
    engine.rate(1); // card 0 → learning, the only drill candidate
    for (let i = 0; i < 4; i += 1) {
      c.advance(2_000);
      engine.rate(4);
    }
    const s = engine.snapshot();
    if (s.step?.kind !== 'drill') throw new Error('expected a drill');
    const ids =
      s.step.exercise.type === 'realia_menu' ? s.step.exercise.cardIds : [s.step.exercise.cardId];
    expect(ids).toContain(pool[0].id);
    // ...but its answer is practice: the word was knocked down minutes ago.
    expect(engine.answerDrill([{ cardId: pool[0].id, correct: true }])).toEqual([]);
    expect(engine.snapshot().results.at(-1)).toMatchObject({ retry: true, applied: false });
  });

  it('never fills the gap with a drill on a card that is waiting it out', () => {
    const pool = makePool();
    const c = clock();
    const engine = engineFor(pool, [pool[0].id, pool[1].id], {
      now: c.now,
      retryGapMs: MIN_RETRY_GAP_MS,
    });
    engine.rate(1); // card 0 → learning, drillable, and re-queued
    c.advance(2_000);
    engine.rate(1); // card 1 likewise; both are now inside their minute
    // Card 0 is the only foil-able candidate besides card 1, and both are waiting.
    expect(engine.snapshot().step?.kind).toBe('wait');
  });
});

describe('StudyEngine — a word in Review is moved only by reading', () => {
  const reviewCard = () =>
    makeCard({
      traditional: '火鍋',
      fsrs: reviewState({ due: '2026-09-05T07:00:00.000Z' }),
      exampleSentenceTraditional: '冬天吃火鍋。',
      visualFoils: ['火渦', '伙鍋'],
    });

  it('books a recognition look for a drill miss on a Review card instead of charging a lapse', () => {
    const pool = makePool();
    const card = reviewCard();
    const all = [...pool, card];
    const drills = buildDrillExercises('foil_discrimination', [card], all, mulberry32(9));
    const events: StudyEvent[] = [];
    const c = clock('2026-09-05T08:00:00.000Z');
    // A daily session whose first step is the drill: the miss must book a card, not a lapse.
    const engine = engineFor(all, [pool[0].id], {
      drills,
      interleaveDrills: true,
      now: c.now,
      onEvent: (e) => events.push(e),
    });
    expect(engine.snapshot().step?.kind).toBe('drill');
    expect(describeDrillOutcome(card, false, true, c.now())).toMatch(
      /^In review.*only your reading/,
    );
    expect(describeDrillOutcome(card, true, true, c.now())).toMatch(
      /^In review 複習中 — no change/,
    );

    expect(engine.answerDrill([{ cardId: card.id, correct: false, picked: '火渦' }])).toEqual([]);
    const after = engine.getCard(card.id)!;
    expect(after.fsrs).toEqual(card.fsrs);
    expect(after.lastAgainAt).toBeUndefined();
    const miss = events.filter((e) => e.kind === 'answer').at(-1)!;
    expect(miss).toMatchObject({
      exerciseType: 'foil_discrimination',
      applied: false,
      booked: true,
      correct: false,
      picked: '火渦',
      rating: 1,
    });
    expect(miss.retry).toBeUndefined();
    expect(engine.snapshot().results.at(-1)).toMatchObject({ retry: true, applied: false });
    // The card is now in the queue, once, behind the planned card.
    expect(engine.remainingCardIds()).toEqual([pool[0].id, card.id]);
    expect(engine.snapshot().total).toBe(2);

    c.advance(30_000);
    engine.rate(4);
    expect(engine.snapshot().step).toEqual({ kind: 'card', cardId: card.id });
    c.advance(30_000);
    // The reading is what the scheduler hears.
    const read = engine.rate(3)!;
    expect(read.log).toMatchObject({
      rating: 3,
      exerciseType: 'rapid_recognition',
      stateBefore: 2,
    });
    expect(read.card.fsrs.reps).toBe(card.fsrs.reps + 1);
    expect(read.card.fsrs.lapses).toBe(0);
    expect(read.card.lastPassAt).toBe(c.now().toISOString());
    expect(engine.snapshot().status).toBe('complete');
  });

  it('books each card once a session and carries the booking across a pause', () => {
    const pool = makePool();
    const card = reviewCard();
    const all = [...pool, card];
    const drills = buildDrillExercises('foil_discrimination', [card, card], all, mulberry32(9));
    const engine = engineFor(all, [], { drills, interleaveDrills: true });
    engine.answerDrill([{ cardId: card.id, correct: false }]);
    engine.answerDrill([{ cardId: card.id, correct: false }]);
    expect(engine.remainingCardIds()).toEqual([card.id]);
    const progress = engine.serialize();
    expect(progress.booked).toEqual([card.id]);
    // Resumed: the booked card is in the saved queue; a new miss cannot add it twice.
    const resumed = engineFor(all, engine.remainingCardIds(), {
      drills: buildDrillExercises('foil_discrimination', [card], all, mulberry32(9)),
      interleaveDrills: true,
      restore: progress,
    });
    resumed.answerDrill([{ cardId: card.id, correct: false }]);
    expect(resumed.remainingCardIds()).toEqual([card.id]);
  });

  it('leaves a standalone drill miss on a Review card as practice, and asks it once more', () => {
    const pool = makePool();
    const card = reviewCard();
    const all = [...pool, card];
    const drills = buildDrillExercises('foil_discrimination', [card], all, mulberry32(9));
    const events: StudyEvent[] = [];
    const engine = engineFor(all, [], {
      drills,
      interleaveDrills: false,
      onEvent: (e) => events.push(e),
    });
    expect(engine.answerDrill([{ cardId: card.id, correct: false }])).toEqual([]);
    expect(engine.getCard(card.id)?.fsrs).toEqual(card.fsrs);
    expect(events.filter((e) => e.kind === 'answer').at(-1)).toMatchObject({ booked: true });
    // The missed item comes back before the end, as before; nothing is queued for recognition.
    expect(engine.snapshot().step?.kind).toBe('drill');
    expect(engine.remainingCardIds()).toEqual([]);
  });

  it('treats any drill answer on a word already read today as practice', () => {
    const pool = makePool();
    const c = clock('2026-09-05T08:00:00.000Z');
    const card = makeCard({
      traditional: '火鍋',
      fsrs: reviewState({ state: 1, stability: 0.3, due: '2026-09-05T07:00:00.000Z' }),
      exampleSentenceTraditional: '冬天吃火鍋。',
      visualFoils: ['火渦', '伙鍋'],
      lastPassAt: '2026-09-05T07:30:00.000Z',
    });
    const all = [...pool, card];
    const drills = buildDrillExercises('foil_discrimination', [card, card], all, mulberry32(9));
    const events: StudyEvent[] = [];
    const engine = engineFor(all, [], {
      drills,
      interleaveDrills: false,
      now: c.now,
      onEvent: (e) => events.push(e),
    });
    expect(describeDrillOutcome(card, false, true, c.now())).toMatch(/^Practice — you read it/);
    expect(engine.answerDrill([{ cardId: card.id, correct: false }])).toEqual([]);
    expect(engine.answerDrill([{ cardId: card.id, correct: true }])).toEqual([]);
    expect(engine.getCard(card.id)?.fsrs).toEqual(card.fsrs);
    expect(events.filter((e) => e.kind === 'answer').map((e) => e.retry)).toEqual([true, true]);
    // Yesterday's reading is spent: a miss counts again.
    const tomorrow = new Date('2026-09-06T08:00:00.000Z');
    expect(describeDrillOutcome(card, false, true, tomorrow)).toMatch(/^Again/);
  });

  it('records the day of a recognition pass, and not of a drill hit', () => {
    const pool = makePool();
    const c = clock('2026-09-05T08:00:00.000Z');
    const engine = engineFor(pool, [pool[0].id, pool[1].id], { now: c.now });
    const hard = engine.rate(2)!;
    expect(hard.card.lastPassAt).toBeUndefined();
    const good = engine.rate(3)!;
    expect(good.card.lastPassAt).toBe(c.now().toISOString());
  });
});

describe('StudyEngine — time on task', () => {
  it('counts at most two minutes for one answer and keeps the raw latency on the event', () => {
    const pool = makePool();
    const events: StudyEvent[] = [];
    const c = clock('2026-09-05T08:00:00.000Z');
    const engine = engineFor(pool, [pool[0].id, pool[1].id], {
      now: c.now,
      onEvent: (e) => events.push(e),
    });
    // The phone goes in a pocket for three hours with the card on screen.
    c.advance(3 * 60 * 60_000);
    engine.reveal();
    const { log } = engine.rate(4)!;
    expect(log.timeSpentMs).toBe(MAX_COUNTED_ANSWER_MS);
    expect(engine.snapshot().results[0].timeMs).toBe(MAX_COUNTED_ANSWER_MS);
    expect(events.filter((e) => e.kind === 'answer')[0].latencyMs).toBe(3 * 60 * 60_000);
    expect(engine.snapshot().elapsedMs).toBe(MAX_COUNTED_ANSWER_MS);
    // A normal answer is counted in full, and the session clock moves with it.
    c.advance(5000);
    engine.rate(4);
    expect(engine.snapshot().results[1].timeMs).toBe(5000);
    expect(engine.snapshot().elapsedMs).toBe(MAX_COUNTED_ANSWER_MS + 5000);
    const end = events.find((e) => e.kind === 'session_end')!;
    expect(end.elapsedMs).toBe(MAX_COUNTED_ANSWER_MS + 5000);
  });
});
