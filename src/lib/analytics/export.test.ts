import { DEFAULT_SETTINGS } from '@/types';
import { makeCard, makeLog } from '@/test/factories';
import type { StudyEvent } from './events';
import {
  buildAnalyticsExport,
  describeEnvironment,
  serializeAnalyticsExport,
  ANALYTICS_SCHEMA,
} from './export';

function makeEvent(overrides: Partial<StudyEvent> = {}): StudyEvent {
  return {
    id: `e${overrides.seq ?? 0}`,
    sessionId: 's1',
    seq: 0,
    at: '2026-09-07T08:00:00.000Z',
    kind: 'answer',
    mode: 'daily',
    ...overrides,
  };
}

describe('buildAnalyticsExport', () => {
  const cards = [makeCard({ traditional: '滷肉飯' }), makeCard({ traditional: '團契' })];
  const logs = [makeLog({ cardId: cards[0].id, reviewTimestamp: '2026-09-07T08:00:00.000Z' })];

  it('stamps the schema, the build and the timezone the timestamps belong to', () => {
    const report = buildAnalyticsExport({
      cards,
      reviewLogs: logs,
      settings: DEFAULT_SETTINGS,
      now: new Date('2026-09-08T18:50:00.000Z'),
    });
    expect(report.schema).toBe(ANALYTICS_SCHEMA);
    expect(report.generatedAt).toBe('2026-09-08T18:50:00.000Z');
    expect(report.environment.appVersion).toBe('test');
    expect(report.environment.timeZone).not.toBe('');
    expect(typeof report.environment.utcOffsetMinutes).toBe('number');
    expect(report.readme.length).toBeGreaterThan(0);
  });

  it('carries only the studied cards, however large the deck', () => {
    const report = buildAnalyticsExport({ cards, reviewLogs: logs, settings: DEFAULT_SETTINGS });
    expect(report.report.deck.totalCards).toBe(2);
    expect(report.report.cards.map((c) => c.traditional)).toEqual(['滷肉飯']);
  });

  it('keeps the newest events and says how many it dropped', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ seq: i, at: `2026-09-07T08:0${i}:00.000Z` }),
    );
    const report = buildAnalyticsExport({
      cards,
      reviewLogs: logs,
      settings: DEFAULT_SETTINGS,
      events,
      maxEvents: 2,
    });
    expect(report.events.complete).toBe(false);
    expect(report.events.dropped).toBe(3);
    expect(report.events.items.map((e) => e.seq)).toEqual([3, 4]);
    expect(report.events.from).toBe('2026-09-07T08:03:00.000Z');
  });

  it('serializes to JSON that parses back', () => {
    const report = buildAnalyticsExport({ cards, reviewLogs: logs, settings: DEFAULT_SETTINGS });
    expect(JSON.parse(serializeAnalyticsExport(report)).schema).toBe(ANALYTICS_SCHEMA);
  });
});

describe('describeEnvironment', () => {
  it('reports the offset with the IANA sign, east of UTC positive', () => {
    const now = new Date('2026-09-08T18:50:00.000Z');
    expect(describeEnvironment(now).utcOffsetMinutes).toBe(-now.getTimezoneOffset());
  });
});
