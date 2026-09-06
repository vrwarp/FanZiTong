/**
 * Model profiles.
 *
 * Latency is the thing to manage here: a single-card edit should feel like
 * pressing a button, while a deck audit is allowed to take minutes. The client
 * picks a profile per action and the sidecar applies it to the turn.
 */

export const PROFILE_NAMES = ['quick', 'deep', 'gardener'] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];

export interface AssistantProfile {
  /** Model id passed to the Agent SDK. */
  model: string;
  effort: 'low' | 'medium' | 'high';
  /** Hard stop on agentic round trips for one turn. */
  maxTurns: number;
  label: string;
}

export const PROFILES: Record<ProfileName, AssistantProfile> = {
  /** One card, one or two tool calls: sentence, foils, a note, an explanation. */
  quick: { model: 'claude-sonnet-5', effort: 'low', maxTurns: 8, label: 'Quick' },
  /** Audits, photo import, coaching: many cards, real judgement. */
  deep: { model: 'claude-opus-5', effort: 'medium', maxTurns: 60, label: 'Thorough' },
  /** Background gap filling; must stay cheap and never outrank the learner. */
  gardener: { model: 'claude-sonnet-5', effort: 'low', maxTurns: 12, label: 'Background' },
};

export function isProfileName(value: string): value is ProfileName {
  return (PROFILE_NAMES as readonly string[]).includes(value);
}
