import type { ReviewLog, UserSettings, VocabCard } from '@/types';
import { sortEvents, STUDY_EVENT_VERSION, type StudyEvent } from './events';
import { buildReport, type AnalyticsReport } from './report';

export const ANALYTICS_SCHEMA = 'fanzitong.analytics';
export const ANALYTICS_SCHEMA_VERSION = 1;

/** Events beyond this are dropped from the file, newest kept. */
export const MAX_EXPORTED_EVENTS = 5_000;

export interface AnalyticsEnvironment {
  appVersion: string;
  buildId: string;
  buildTime: string;
  /** IANA zone and the offset in effect when the file was written. */
  timeZone: string;
  utcOffsetMinutes: number;
  language: string;
  userAgent: string;
}

export interface AnalyticsExport {
  schema: typeof ANALYTICS_SCHEMA;
  schemaVersion: number;
  eventVersion: number;
  generatedAt: string;
  /** Read this first: what the file is and what it is not. */
  readme: string[];
  environment: AnalyticsEnvironment;
  report: AnalyticsReport;
  events: {
    /** False when the device holds more events than the file could carry. */
    complete: boolean;
    dropped: number;
    from: string | null;
    to: string | null;
    items: StudyEvent[];
  };
}

const README = [
  'Study analytics for 繁字通 (FanZiTong). This is a diagnostic file, not a backup:',
  'it cannot restore a deck, and it carries no card content beyond the words the',
  'learner has actually studied.',
  'report.diagnostics lists the patterns the app found in its own data — start there.',
  'report.activity.sessions is reconstructed from the gaps between answers; the',
  'events array carries real session boundaries for study done since events shipped.',
  'A review log exists only when a rating moved the schedule, so answers that FSRS',
  'ignored (a correct drill answer on a card already in Review) appear in events only.',
];

/** Timezone and build details, so timestamps and day boundaries can be read. */
export function describeEnvironment(now: Date = new Date()): AnalyticsEnvironment {
  const resolved =
    typeof Intl === 'undefined' ? undefined : Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown',
    buildId: typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'unknown',
    buildTime: typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'unknown',
    timeZone: resolved ?? 'unknown',
    // Positive east of UTC, matching the IANA sign rather than the JS one.
    utcOffsetMinutes: -now.getTimezoneOffset(),
    language: typeof navigator === 'undefined' ? 'unknown' : navigator.language,
    userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
  };
}

export interface AnalyticsExportInput {
  cards: VocabCard[];
  reviewLogs: ReviewLog[];
  settings: UserSettings;
  events?: StudyEvent[];
  now?: Date;
  maxEvents?: number;
}

/**
 * Build the analytics export.
 *
 * The full backup answers "what does this learner own"; this answers "what has
 * this learner been doing, and where is the app getting in their way". It keeps
 * only the cards that have been studied, so it stays small enough to read
 * whole however large the deck grows.
 */
export function buildAnalyticsExport(input: AnalyticsExportInput): AnalyticsExport {
  const now = input.now ?? new Date();
  const limit = input.maxEvents ?? MAX_EXPORTED_EVENTS;
  const all = sortEvents(input.events ?? []);
  const items = all.slice(Math.max(0, all.length - limit));
  return {
    schema: ANALYTICS_SCHEMA,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    eventVersion: STUDY_EVENT_VERSION,
    generatedAt: now.toISOString(),
    readme: README,
    environment: describeEnvironment(now),
    report: buildReport(input.cards, input.reviewLogs, input.settings),
    events: {
      complete: items.length === all.length,
      dropped: all.length - items.length,
      from: items[0]?.at ?? null,
      to: items[items.length - 1]?.at ?? null,
      items,
    },
  };
}

export function serializeAnalyticsExport(report: AnalyticsExport): string {
  return JSON.stringify(report, null, 2);
}
