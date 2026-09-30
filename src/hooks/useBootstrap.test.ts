import { createDatabase } from '@/db/database';
import { createRepository, META_KEYS } from '@/db/repository';
import { buildStarterDeck, planStarterRestore, starterDeckSize } from '@/data/starterDeck';
import {
  GONG_WAN_TANG_HISTORY,
  makeCard,
  makeLog,
  reviewState,
  studyOldWay,
} from '@/test/factories';
import type { StudyEvent } from '@/lib/analytics/events';
import {
  backfillLearnerStateOnce,
  bootstrapDatabase,
  parseRepairSummary,
  reconcileStudyCounts,
  repairSchedulesOnce,
  restoreFromEvents,
} from './useBootstrap';

describe('bootstrapDatabase', () => {
  it('seeds the starter deck exactly once on an empty database', async () => {
    const repo = createRepository(createDatabase('bootstrap-1'));
    expect(await bootstrapDatabase(repo)).toBe(true);
    expect(await repo.countCards()).toBe(await starterDeckSize());
    expect(await repo.getMeta(META_KEYS.seededAt)).toBeTruthy();
    expect(await bootstrapDatabase(repo)).toBe(false);
    expect(await repo.countCards()).toBe(await starterDeckSize());
    await repo.db.delete();
  });

  it('does not seed when the user already has cards', async () => {
    const repo = createRepository(createDatabase('bootstrap-2'));
    await repo.putCard(makeCard());
    expect(await bootstrapDatabase(repo)).toBe(false);
    expect(await repo.countCards()).toBe(1);
    await repo.db.delete();
  });
});

describe('a seeded deck and the restore control', () => {
  // The whole point of the control is to be quiet unless something is actually
  // wrong. A deck that was seeded from the shipped rows and then read back out
  // of IndexedDB must report nothing to do — otherwise every learner who has
  // simply used the app would be told 95 of their cards need repairing.
  it('has nothing to add and nothing to repair after a normal first launch', async () => {
    const repo = createRepository(createDatabase('bootstrap-restore'));
    try {
      await bootstrapDatabase(repo);
      const stored = await repo.getAllCards();
      const plan = planStarterRestore(stored, await buildStarterDeck());
      expect(stored).toHaveLength(await starterDeckSize());
      expect(plan.add).toHaveLength(0);
      expect(plan.repair).toHaveLength(0);
    } finally {
      await repo.db.delete();
    }
  });
});

describe('the one-time schedule repair', () => {
  it('rewrites looped cards once, and records what it did', async () => {
    const repo = createRepository(createDatabase('bootstrap-repair'));
    try {
      const looped = studyOldWay(makeCard({ traditional: '貢丸湯' }), GONG_WAN_TANG_HISTORY);
      await repo.importCards([looped.card, makeCard({ traditional: '蛋餅' })], looped.logs);
      expect(await bootstrapDatabase(repo)).toBe(false);

      const stored = await repo.getCard(looped.card.id);
      expect(stored?.fsrs.difficulty).toBeLessThan(looped.card.fsrs.difficulty);
      // The day-two miss fell on a word still at its three-hour step: not a lapse.
      expect(stored?.fsrs.lapses).toBe(0);
      expect(stored?.lastAgainAt).toBe('2026-09-08T13:58:49.000Z');
      expect(stored?.lastPassAt).toBe('2026-09-08T14:01:16.000Z');
      const summary = parseRepairSummary(await repo.getMeta(META_KEYS.scheduleRepair));
      expect(summary).toMatchObject({ rule: 3, repaired: 1, annotated: 0, words: ['貢丸湯'] });
      expect(await repo.getMeta(META_KEYS.scheduleRepairV1)).toBeUndefined();

      // A second launch finds the marker and touches nothing.
      expect(await repairSchedulesOnce(repo)).toBeNull();
      expect((await repo.getCard(looped.card.id))?.fsrs).toEqual(stored?.fsrs);
    } finally {
      await repo.db.delete();
    }
  });

  it('marks a fresh device as done without writing any card', async () => {
    const repo = createRepository(createDatabase('bootstrap-repair-fresh'));
    try {
      await bootstrapDatabase(repo);
      const summary = parseRepairSummary(await repo.getMeta(META_KEYS.scheduleRepair));
      expect(summary).toMatchObject({ repaired: 0, annotated: 0, unverifiable: 0, words: [] });
    } finally {
      await repo.db.delete();
    }
  });

  it('reads back only a well-formed summary', () => {
    expect(parseRepairSummary(undefined)).toBeNull();
    expect(parseRepairSummary('not json')).toBeNull();
    expect(parseRepairSummary('{"at":"x"}')).toBeNull();
    expect(parseRepairSummary('{"at":"2026-09-09T00:00:00.000Z","repaired":2}')).toEqual({
      at: '2026-09-09T00:00:00.000Z',
      rule: 1,
      repaired: 2,
      annotated: 0,
      unverifiable: 0,
      words: [],
    });
  });
});

describe('reconcileStudyCounts', () => {
  const logsFor = (cardId: string) =>
    (
      [
        [1, 0, '2026-09-09T15:00:00.000Z'], // first sight: not a slip
        [1, 1, '2026-09-10T15:00:00.000Z'],
        [1, 1, '2026-09-11T15:00:00.000Z'],
        [2, 1, '2026-09-12T15:00:00.000Z'],
        [2, 2, '2026-09-13T15:00:00.000Z'],
        [2, 2, '2026-09-13T16:00:00.000Z'], // same day: one hard day
      ] as const
    ).map(([rating, stateBefore, reviewTimestamp]) =>
      makeLog({ cardId, rating, stateBefore, reviewTimestamp }),
    );

  it('counts each studied word’s slip days and hard days from its log, on every launch', async () => {
    const repo = createRepository(createDatabase('bootstrap-counts'));
    try {
      const card = makeCard({ fsrs: reviewState({ reps: 6, lapses: 0 }) });
      await repo.putCard(card);
      for (const log of logsFor(card.id)) await repo.addReviewLog(log);
      expect(await reconcileStudyCounts(repo)).toBe(1);
      expect(await repo.getCard(card.id)).toMatchObject({ slipDays: 2, hardDays: 2 });
      // Nothing to do while the counts agree with the log.
      expect(await reconcileStudyCounts(repo)).toBe(0);
      // A count rolled back by a restore is put right on the next launch.
      await repo.putCard({ ...card, slipDays: 0, hardDays: undefined });
      expect(await reconcileStudyCounts(repo)).toBe(1);
      expect(await repo.getCard(card.id)).toMatchObject({ slipDays: 2, hardDays: 2 });
      // A word never studied stays untouched.
      const fresh = makeCard({ traditional: '蛋餅' });
      await repo.putCard(fresh);
      expect(await reconcileStudyCounts(repo)).toBe(0);
      expect((await repo.getCard(fresh.id))?.slipDays).toBeUndefined();
    } finally {
      await repo.db.delete();
    }
  });

  it('reads a word that was started over from its restart', async () => {
    const repo = createRepository(createDatabase('bootstrap-counts-restart'));
    try {
      const card = makeCard({
        fsrs: reviewState({ reps: 6 }),
        restartedAt: '2026-09-12T00:00:00.000Z',
        slipDays: 4,
      });
      await repo.putCard(card);
      for (const log of logsFor(card.id)) await repo.addReviewLog(log);
      expect(await reconcileStudyCounts(repo)).toBe(1);
      expect(await repo.getCard(card.id)).toMatchObject({ slipDays: 0, hardDays: 2 });
    } finally {
      await repo.db.delete();
    }
  });
});

describe('backfillLearnerStateOnce', () => {
  const event = (over: Partial<StudyEvent>): StudyEvent => ({
    id: over.id ?? `${over.kind}-${over.at}`,
    sessionId: 's1',
    seq: 0,
    at: '2026-09-21T07:33:00.000Z',
    kind: 'intro',
    mode: 'daily',
    ...over,
  });

  it('writes back the introduction and the ear check the events remember, once', async () => {
    const repo = createRepository(createDatabase('bootstrap-learner-state'));
    try {
      const lost = makeCard({ fsrs: reviewState({ reps: 3 }) });
      const kept = makeCard({
        traditional: '傲嬌',
        fsrs: reviewState({ reps: 3 }),
        introducedAt: '2026-09-01T00:00:00.000Z',
        byEar: { at: '2026-09-02T00:00:00.000Z', known: false },
      });
      await repo.putCards([lost, kept]);
      const events: StudyEvent[] = [
        event({ cardId: lost.id, seq: 1 }),
        event({ cardId: lost.id, seq: 5, at: '2026-09-22T07:33:00.000Z' }),
        event({ cardId: kept.id, seq: 2, at: '2026-09-21T07:40:00.000Z' }),
        event({
          kind: 'answer',
          cardId: lost.id,
          seq: 3,
          at: '2026-09-23T08:00:00.000Z',
          exerciseType: 'meaning_to_form',
          heard: false,
        }),
        event({
          kind: 'answer',
          cardId: lost.id,
          seq: 4,
          at: '2026-09-26T08:00:00.000Z',
          exerciseType: 'meaning_to_form',
          heard: true,
        }),
      ];
      for (const e of events) await repo.addStudyEvent(e);

      expect(await backfillLearnerStateOnce(repo)).toBe(1);
      expect(await repo.getCard(lost.id)).toMatchObject({
        introducedAt: '2026-09-21T07:33:00.000Z',
        byEar: { at: '2026-09-26T08:00:00.000Z', known: true },
      });
      // A card that still has its record keeps it.
      expect(await repo.getCard(kept.id)).toMatchObject({
        introducedAt: kept.introducedAt,
        byEar: kept.byEar,
      });
      expect(await repo.getMeta(META_KEYS.learnerStateBackfill)).toBeTruthy();
      // Once: a later loss is not repaired from events again.
      await repo.putCard({ ...lost, introducedAt: undefined });
      expect(await backfillLearnerStateOnce(repo)).toBe(0);
      expect((await repo.getCard(lost.id))?.introducedAt).toBeUndefined();
    } finally {
      await repo.db.delete();
    }
  });

  it('touches only the cards with something to restore', () => {
    const card = makeCard();
    expect(restoreFromEvents([card], [])).toEqual([]);
    expect(restoreFromEvents([card], [event({ cardId: 'someone-else' })])).toEqual([]);
  });
});
