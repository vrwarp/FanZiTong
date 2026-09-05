import { buildClozeExercise } from '@/lib/exercises/cloze';
import { buildFoilExercise } from '@/lib/exercises/foil';
import { buildMenuExercise, MENU_MAX_TARGETS } from '@/lib/exercises/menu';
import { hasClozeSentence, isActiveDomain, isDrillCandidate } from '@/lib/queue/session';
import { shuffle, type Rng } from '@/lib/util/random';
import {
  CardState,
  type DomainCategory,
  type ExerciseType,
  type UserSettings,
  type VocabCard,
} from '@/types';
import type { DrillExercise } from './engine';

export type DrillType = Exclude<ExerciseType, 'rapid_recognition'>;

export const DRILL_TYPES: DrillType[] = ['cloze', 'realia_menu', 'foil_discrimination'];

export function isDrillType(value: unknown): value is DrillType {
  return typeof value === 'string' && (DRILL_TYPES as string[]).includes(value);
}

export interface DrillSelectionOptions {
  type: DrillType;
  count: number;
  now: Date;
  domain?: DomainCategory;
  /** Restrict to these card ids (e.g. leeches from the Stats tab). */
  onlyIds?: string[];
  rng?: Rng;
}

function priority(card: VocabCard, now: Date): number {
  // Leeches/lapsed first, then (re)learning, then due reviews, then the rest.
  if (card.fsrs.lapses > 0) return 0;
  if (card.fsrs.state === CardState.Learning || card.fsrs.state === CardState.Relearning) return 1;
  if (card.fsrs.state === CardState.Review && new Date(card.fsrs.due).getTime() <= now.getTime())
    return 2;
  if (card.fsrs.state === CardState.Review) return 3;
  return 4;
}

/** Pick cards for a standalone drill, hardest/most-urgent first. */
export function selectDrillCards(
  cards: VocabCard[],
  settings: UserSettings,
  options: DrillSelectionOptions,
): VocabCard[] {
  const rng = options.rng ?? Math.random;
  let eligible = cards.filter((c) => isActiveDomain(c, settings));
  if (options.onlyIds) {
    const set = new Set(options.onlyIds);
    eligible = eligible.filter((c) => set.has(c.id));
  }
  if (options.domain) eligible = eligible.filter((c) => c.domain === options.domain);
  if (options.type === 'realia_menu') eligible = eligible.filter((c) => c.domain === 'food');
  if (options.type === 'cloze') eligible = eligible.filter(hasClozeSentence);

  const buckets = new Map<number, VocabCard[]>();
  for (const card of eligible) {
    const p = priority(card, options.now);
    buckets.set(p, [...(buckets.get(p) ?? []), card]);
  }
  const ordered: VocabCard[] = [];
  for (const p of [0, 1, 2, 3, 4]) {
    const bucket = buckets.get(p) ?? [];
    ordered.push(
      ...shuffle(bucket, rng).sort((a, b) =>
        p === 0
          ? b.fsrs.lapses - a.fsrs.lapses
          : Number(isDrillCandidate(b)) - Number(isDrillCandidate(a)),
      ),
    );
  }
  return ordered.slice(0, options.count);
}

/** Turn selected cards into concrete exercises (menus group up to 3 cards each). */
export function buildDrillExercises(
  type: DrillType,
  selected: VocabCard[],
  pool: VocabCard[],
  rng: Rng = Math.random,
): DrillExercise[] {
  const exercises: DrillExercise[] = [];
  if (type === 'realia_menu') {
    for (let i = 0; i < selected.length; i += MENU_MAX_TARGETS) {
      const group = selected.slice(i, i + MENU_MAX_TARGETS);
      // Pad a lonely last group with another food card so the slip stays realistic.
      if (group.length < 2) {
        const extra = pool.find((c) => c.domain === 'food' && !group.some((g) => g.id === c.id));
        if (extra) group.push(extra);
      }
      const ex = buildMenuExercise(group, rng);
      if (ex) exercises.push(ex);
    }
    return exercises;
  }
  for (const card of selected) {
    const ex =
      type === 'cloze' ? buildClozeExercise(card, pool, rng) : buildFoilExercise(card, pool, rng);
    if (ex) exercises.push(ex);
  }
  return exercises;
}
