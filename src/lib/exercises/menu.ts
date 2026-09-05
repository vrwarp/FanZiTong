import type { VocabCard } from '@/types';
import {
  MENU_TEMPLATE,
  categorizeDish,
  type MenuCategoryId,
  type MenuSize,
} from '@/data/menuTemplate';
import { hanChars } from '@/lib/util/pinyin';
import { pick, sample, shuffle, type Rng } from '@/lib/util/random';
import { expandFoil } from './foil';

export const MENU_TIME_LIMIT_MS = 20_000;
export const MENU_MIN_TARGETS = 2;
export const MENU_MAX_TARGETS = 3;
export const MENU_ITEMS_PER_CATEGORY = 5;

export interface MenuItem {
  id: string;
  label: string;
  category: MenuCategoryId;
  sized: boolean;
  /** Set when this row is one of the learner's cards. */
  cardId?: string;
  /** Set when this row is a look-alike distractor for a target card. */
  foilOf?: string;
}

export interface MenuCategory {
  id: MenuCategoryId;
  name: string;
  sized: boolean;
  items: MenuItem[];
}

export interface MenuTarget {
  cardId: string;
  itemId: string;
  label: string;
  size?: MenuSize;
  /** Selection key the learner must tick, e.g. "item-3:小". */
  key: string;
}

export interface MenuExercise {
  type: 'realia_menu';
  cardIds: string[];
  targets: MenuTarget[];
  categories: MenuCategory[];
  timeLimitMs: number;
}

export function selectionKey(itemId: string, size?: MenuSize): string {
  return size ? `${itemId}:${size}` : itemId;
}

/** Human prompt, e.g. "滷肉飯 (小)、貢丸湯、地瓜葉". */
export function formatOrderPrompt(targets: MenuTarget[]): string {
  return targets.map((t) => (t.size ? `${t.label} (${t.size})` : t.label)).join('、');
}

/**
 * Build an order-slip simulation around 2–3 target food cards. Each target's
 * look-alike foil (if any) is printed in the same category as a distractor,
 * and the rest of the slip is filled with authentic menu staples.
 */
export function buildMenuExercise(
  targetCards: VocabCard[],
  rng: Rng = Math.random,
): MenuExercise | null {
  const usable = targetCards.filter((c) => hanChars(c.traditional).length > 0);
  if (usable.length === 0) return null;
  const chosen = sample(usable, MENU_MAX_TARGETS, rng);

  let nextId = 0;
  const makeId = () => `item-${(nextId += 1)}`;
  const byCategory = new Map<MenuCategoryId, MenuItem[]>();
  const usedLabels = new Set<string>();
  const targets: MenuTarget[] = [];

  const addItem = (item: Omit<MenuItem, 'id'>): MenuItem => {
    const full: MenuItem = { id: makeId(), ...item };
    const list = byCategory.get(item.category) ?? [];
    list.push(full);
    byCategory.set(item.category, list);
    usedLabels.add(item.label);
    return full;
  };

  for (const card of chosen) {
    const category = categorizeDish(card.traditional);
    const template = MENU_TEMPLATE.find((t) => t.id === category)!;
    const item = addItem({
      label: card.traditional,
      category,
      sized: template.sized,
      cardId: card.id,
    });
    const size = template.sized ? pick([...MENU_SIZES_LOCAL], rng) : undefined;
    targets.push({
      cardId: card.id,
      itemId: item.id,
      label: card.traditional,
      size,
      key: selectionKey(item.id, size),
    });
    const foil = shuffle(card.visualFoils ?? [], rng)
      .map((f) => expandFoil(card.traditional, f))
      .find((f): f is string => f !== null && !usedLabels.has(f));
    if (foil) {
      addItem({ label: foil, category, sized: template.sized, foilOf: card.id });
    }
  }

  // Fill every category that has a target (and one extra for realism) with fillers.
  const categoriesToRender = new Set<MenuCategoryId>(byCategory.keys());
  const spare = MENU_TEMPLATE.filter((t) => !categoriesToRender.has(t.id));
  const extra = pick(spare, rng);
  if (extra) categoriesToRender.add(extra.id);

  const categories: MenuCategory[] = MENU_TEMPLATE.filter((t) => categoriesToRender.has(t.id)).map(
    (template) => {
      const existing = byCategory.get(template.id) ?? [];
      const fillers = shuffle(
        template.fillers.filter((f) => !usedLabels.has(f)),
        rng,
      ).slice(0, Math.max(0, MENU_ITEMS_PER_CATEGORY - existing.length));
      for (const label of fillers) {
        existing.push({ id: makeId(), label, category: template.id, sized: template.sized });
        usedLabels.add(label);
      }
      return {
        id: template.id,
        name: template.name,
        sized: template.sized,
        items: shuffle(existing, rng),
      };
    },
  );

  return {
    type: 'realia_menu',
    cardIds: chosen.map((c) => c.id),
    targets: shuffle(targets, rng),
    categories,
    timeLimitMs: MENU_TIME_LIMIT_MS,
  };
}

const MENU_SIZES_LOCAL: readonly MenuSize[] = ['小', '大'];

export interface MenuGrade {
  /** Per target card: true when exactly the right box was ticked and none of its look-alikes. */
  perCard: Record<string, boolean>;
  /** Selection keys ticked that belong to no target (or a target's wrong size / foil). */
  wrongSelections: string[];
  missed: MenuTarget[];
  allCorrect: boolean;
}

/** Grade the learner's ticked boxes against the order. */
export function gradeMenuExercise(exercise: MenuExercise, selected: Set<string>): MenuGrade {
  const perCard: Record<string, boolean> = {};
  const validKeys = new Set(exercise.targets.map((t) => t.key));
  const missed: MenuTarget[] = [];
  const itemsById = new Map<string, MenuItem>();
  for (const category of exercise.categories) {
    for (const item of category.items) itemsById.set(item.id, item);
  }

  for (const target of exercise.targets) {
    const ticked = selected.has(target.key);
    // Any tick on a foil of this card, or on the same item with another size, is a miss.
    const confusable = Array.from(selected).some((key) => {
      if (key === target.key) return false;
      const itemId = key.split(':')[0];
      const item = itemsById.get(itemId);
      if (!item) return false;
      return item.foilOf === target.cardId || item.id === target.itemId;
    });
    const ok = ticked && !confusable;
    perCard[target.cardId] = ok;
    if (!ok) missed.push(target);
  }

  const wrongSelections = Array.from(selected).filter((key) => !validKeys.has(key));
  return {
    perCard,
    wrongSelections,
    missed,
    allCorrect: missed.length === 0 && wrongSelections.length === 0,
  };
}
