import { repository } from '@/db/repository';
import type { StudyEvent } from './events';

/**
 * Persist one study event without making the learner wait for it.
 *
 * Analytics must never sit between a tap and the next card, so writes are not
 * awaited and a failure is logged rather than surfaced: a lost event is worth
 * far less than an interrupted session.
 */
export function recordStudyEvent(event: StudyEvent): void {
  repository.addStudyEvent(event).catch((err: unknown) => {
    console.error('Failed to record study event', err);
  });
  // The log is trimmed at a session boundary, never mid-answer.
  if (event.kind === 'session_end') {
    repository.trimStudyEvents().catch((err: unknown) => {
      console.error('Failed to trim study events', err);
    });
  }
}
