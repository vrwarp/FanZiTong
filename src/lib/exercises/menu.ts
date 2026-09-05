import type { VocabCard } from '@/types';
import {
  MENU_SIZES,
  SHOP_TEMPLATES,
  categorizeDish,
  categoryTemplate,
  chooseShopType,
  priceFor,
  type MenuCategoryId,
  type MenuSize,
  type ShopType,
} from '@/data/menuTemplate';
import { hanChars } from '@/lib/util/pinyin';
import { pick, sample, shuffle, type Rng } from '@/lib/util/random';
import { expandFoil, isVariantOf } from './foil';

export const MENU_TIME_LIMIT_MS = 20_000;
export const MENU_MIN_TARGETS = 2;
export const MENU_MAX_TARGETS = 3;
export const MENU_ITEMS_PER_CATEGORY = 4;
/** Chance that a card with accepted variants is printed in its variant spelling. */
const VARIANT_PRINT_PROBABILITY = 0.5;

export interface MenuItem {
  id: string;
  /** Text printed on the slip (may be an accepted variant spelling of a card). */
  label: string;
  category: MenuCategoryId;
  sized: boolean;
  price: number | [number, number];
  /** Set when this row is one of the learner's cards. */
  cardId?: string;
  /** Set when this row is a look-alike distractor for a target card. */
  foilOf?: string;
  /** The card's standard spelling when the printed label is a variant. */
  variantOf?: string;
  /** Reading and meaning, revealed only after grading (incidental learning). */
  pinyin?: string;
  gloss?: string;
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
  /** Text as printed on the slip. */
  label: string;
  /** The card's standard spelling (what the learner studies). */
  standard: string;
  pinyin: string;
  definition: string;
  size?: MenuSize;
  /** Selection key the learner must tick, e.g. "item-3:小". */
  key: string;
}

export interface MenuExercise {
  type: 'realia_menu';
  shop: { type: ShopType; name: string };
  cardIds: string[];
  targets: MenuTarget[];
  categories: MenuCategory[];
  timeLimitMs: number;
}

export function selectionKey(itemId: string, size?: MenuSize): string {
  return size ? `${itemId}:${size}` : itemId;
}

/** Characters-only version of the order, shown only after grading, e.g. "滷肉飯 (小)、貢丸湯". */
export function formatOrderPrompt(targets: MenuTarget[]): string {
  return targets.map((t) => (t.size ? `${t.standard} (${t.size})` : t.standard)).join('、');
}

/**
 * Build an order-slip simulation around 2–3 target food cards. The order is
 * cued by sound + meaning (the way a friend says it), so the learner has to
 * READ the slip to find the dishes. Each target's look-alike foil (if any) is
 * printed in the same category, and the rest of the slip is filled with
 * authentic staples of the shop type that fits the targets.
 */
export function buildMenuExercise(
  targetCards: VocabCard[],
  rng: Rng = Math.random,
): MenuExercise | null {
  const usable = targetCards.filter((c) => hanChars(c.traditional).length > 0);
  if (usable.length === 0) return null;
  const chosen = sample(usable, MENU_MAX_TARGETS, rng);

  const categoriesOfTargets = chosen.map((c) => categorizeDish(c.traditional));
  const shop = SHOP_TEMPLATES[chooseShopType(categoriesOfTargets)];

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

  chosen.forEach((card, index) => {
    const category = categoriesOfTargets[index];
    const template = categoryTemplate(category);
    // Real menus write 滷肉飯 as 魯肉飯 half the time; print the variant sometimes.
    const variants = (card.variants ?? []).map((v) => v.trim()).filter(Boolean);
    const printed =
      variants.length > 0 && rng() < VARIANT_PRINT_PROBABILITY
        ? pick(variants, rng)!
        : card.traditional;
    const item = addItem({
      label: printed,
      category,
      sized: template.sized,
      price: priceFor(card.traditional, template.defaultPrice),
      cardId: card.id,
      variantOf: printed === card.traditional ? undefined : card.traditional,
      pinyin: card.pinyin,
      gloss: card.definition,
    });
    const size = template.sized ? pick([...MENU_SIZES], rng) : undefined;
    targets.push({
      cardId: card.id,
      itemId: item.id,
      label: printed,
      standard: card.traditional,
      pinyin: card.pinyin,
      definition: card.definition,
      size,
      key: selectionKey(item.id, size),
    });
    // Look-alike distractor — never an accepted variant of the dish.
    const foil = shuffle(card.visualFoils ?? [], rng)
      .map((f) => expandFoil(card.traditional, f))
      .find((f): f is string => f !== null && !usedLabels.has(f) && !isVariantOf(card, f));
    if (foil) {
      addItem({
        label: foil,
        category,
        sized: template.sized,
        price: priceFor(foil, template.defaultPrice),
        foilOf: card.id,
      });
    }
  });

  // Render the shop's own sections plus any section a target needs.
  const categoriesToRender: MenuCategoryId[] = [];
  for (const id of [...shop.categories, ...categoriesOfTargets]) {
    if (!categoriesToRender.includes(id)) categoriesToRender.push(id);
  }
  // Keep the slip readable inside 20 seconds: at most four sections.
  const trimmed = categoriesToRender.filter(
    (id, i) => byCategory.has(id) || i < 4 - new Set(categoriesOfTargets).size,
  );

  const categories: MenuCategory[] = trimmed.map((id) => {
    const template = categoryTemplate(id);
    const existing = byCategory.get(id) ?? [];
    const fillers = shuffle(
      template.fillers.filter((f) => !usedLabels.has(f.label)),
      rng,
    ).slice(0, Math.max(0, MENU_ITEMS_PER_CATEGORY - existing.length));
    for (const filler of fillers) {
      existing.push({
        id: makeId(),
        label: filler.label,
        category: id,
        sized: template.sized,
        price: filler.price,
        pinyin: filler.pinyin,
        gloss: filler.gloss,
      });
      usedLabels.add(filler.label);
    }
    return { id, name: template.name, sized: template.sized, items: shuffle(existing, rng) };
  });

  return {
    type: 'realia_menu',
    shop: { type: shop.type, name: shop.name },
    cardIds: chosen.map((c) => c.id),
    targets: shuffle(targets, rng),
    categories,
    timeLimitMs: MENU_TIME_LIMIT_MS,
  };
}

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

export function formatPrice(price: number | [number, number]): string {
  return Array.isArray(price) ? `${price[0]}/${price[1]}` : String(price);
}
