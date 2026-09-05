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
  type MenuFiller,
} from '@/data/menuTemplate';
import { hanChars } from '@/lib/util/pinyin';
import { pick, sample, shuffle, type Rng } from '@/lib/util/random';

export const MENU_TIME_LIMIT_MS = 20_000;
export const MENU_MIN_TARGETS = 2;
export const MENU_MAX_TARGETS = 3;
export const MENU_ITEMS_PER_CATEGORY = 3;
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
  /**
   * Set when this real dish shares a character with an ordered dish in the same
   * section (滷肉飯 ↔ 焢肉飯, 牛肉麵 ↔ 牛肉湯麵): the confusion a real counter offers.
   */
  neighbourOf?: string;
  /** The card's standard spelling when the printed label is a variant. */
  variantOf?: string;
  /** Reading and meaning, revealed only after grading (incidental learning). */
  pinyin?: string;
  gloss?: string;
  spoken?: string;
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
  /** How the friend actually says it (Taiwanese reading when that is what people use). */
  spoken?: string;
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
      spoken: card.spoken,
    });
    const size = template.sized ? pick([...MENU_SIZES], rng) : undefined;
    targets.push({
      cardId: card.id,
      itemId: item.id,
      label: printed,
      standard: card.traditional,
      pinyin: card.pinyin,
      spoken: card.spoken,
      definition: card.definition,
      size,
      key: selectionKey(item.id, size),
    });
  });

  // A real slip confuses you with real neighbours (焢肉飯 next to 滷肉飯, 牛肉湯麵
  // next to 牛肉麵), never with invented look-alikes — those belong to Spot the
  // Character. The shop's own sections are always printed, plus any section a
  // target needs, each filled with authentic dishes of that section.

  const categoriesToRender: MenuCategoryId[] = [];
  for (const id of [...shop.categories, ...categoriesOfTargets]) {
    if (!categoriesToRender.includes(id)) categoriesToRender.push(id);
  }

  const categories: MenuCategory[] = categoriesToRender.map((id) => {
    const template = categoryTemplate(id);
    const existing = byCategory.get(id) ?? [];
    const targetsHere = existing.filter((item) => item.cardId);
    const available = template.fillers.filter((f) => !usedLabels.has(f.label));
    // Every ordered dish gets at least one real neighbour in its section when
    // the template has one; the rest of the section is filled at random.
    const neighbourFor = new Map<string, string>();
    const chosenFillers: MenuFiller[] = [];
    for (const target of targetsHere) {
      const candidates = available.filter(
        (f) => !chosenFillers.includes(f) && isNeighbour(target.label, f.label),
      );
      const neighbour = pick(candidates, rng);
      if (neighbour) {
        chosenFillers.push(neighbour);
        neighbourFor.set(neighbour.label, target.cardId!);
      }
    }
    const rest = shuffle(
      available.filter((f) => !chosenFillers.includes(f)),
      rng,
    ).slice(0, Math.max(0, MENU_ITEMS_PER_CATEGORY - existing.length - chosenFillers.length));
    for (const filler of [...chosenFillers, ...rest]) {
      existing.push({
        id: makeId(),
        label: filler.label,
        category: id,
        sized: template.sized,
        price: filler.price,
        pinyin: filler.pinyin,
        gloss: filler.gloss,
        spoken: filler.spoken,
        neighbourOf: neighbourFor.get(filler.label),
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
  /** cardId → read correctly: its dish ticked (any size) and no look-alike of it ticked. */
  perCard: Record<string, boolean>;
  /** Ticked keys that belong to no ordered dish, in any size. */
  wrongSelections: string[];
  missed: MenuTarget[];
  /** Right dish, wrong size column: reported in the verdict, not a reading miss. */
  sizeErrors: MenuTarget[];
  allCorrect: boolean;
}

/** Grade the learner's ticked boxes against the order. */
export function gradeMenuExercise(exercise: MenuExercise, selected: Set<string>): MenuGrade {
  const perCard: Record<string, boolean> = {};
  const missed: MenuTarget[] = [];
  const sizeErrors: MenuTarget[] = [];
  const itemsById = new Map<string, MenuItem>();
  for (const category of exercise.categories) {
    for (const item of category.items) itemsById.set(item.id, item);
  }
  const itemOf = (key: string) => itemsById.get(key.split(':')[0]);
  const orderedItemIds = new Set(exercise.targets.map((t) => t.itemId));
  const ticks = Array.from(selected);

  for (const target of exercise.targets) {
    const ticked = selected.has(target.key);
    const otherSize = ticks.some((key) => key !== target.key && itemOf(key)?.id === target.itemId);
    // Reading the dish is what is graded: a tick in the wrong size column is a
    // slip of the pen, not a misread, so the card still counts as read.
    const ok = ticked || otherSize;
    perCard[target.cardId] = ok;
    if (!ok) missed.push(target);
    else if (otherSize) sizeErrors.push(target);
  }

  const wrongSelections = ticks.filter((key) => {
    const item = itemOf(key);
    return !item || !orderedItemIds.has(item.id);
  });
  return {
    perCard,
    wrongSelections,
    missed,
    sizeErrors,
    allCorrect: missed.length === 0 && wrongSelections.length === 0 && sizeErrors.length === 0,
  };
}

/** Section suffixes every dish in the section shares; they do not make two dishes neighbours. */
const GENERIC_DISH_CHARS = new Set(['飯', '麵', '湯', '茶', '菜']);

/** Two real dishes are neighbours when they share a character beyond the section suffix. */
export function isNeighbour(a: string, b: string): boolean {
  if (a === b) return false;
  const shared = new Set(Array.from(a).filter((ch) => !GENERIC_DISH_CHARS.has(ch)));
  return Array.from(b).some((ch) => shared.has(ch));
}

/** The sound the friend says: the spoken reading when people use it, else the pinyin. */
export function cueReading(target: Pick<MenuTarget, 'pinyin' | 'spoken'>): string {
  return target.spoken ?? target.pinyin;
}

export function formatPrice(price: number | [number, number]): string {
  return Array.isArray(price) ? `${price[0]}/${price[1]}` : String(price);
}
