import { MENU_TEMPLATE, categorizeDish } from '@/data/menuTemplate';
import { mulberry32 } from '@/lib/util/random';
import { containsPinyin } from '@/lib/util/pinyin';
import { makeCard, makePool } from '@/test/factories';
import {
  buildMenuExercise,
  formatOrderPrompt,
  gradeMenuExercise,
  MENU_TIME_LIMIT_MS,
  selectionKey,
} from './menu';

describe('categorizeDish', () => {
  it('routes dishes to the right slip section', () => {
    expect(categorizeDish('滷肉飯')).toBe('rice');
    expect(categorizeDish('飯糰')).toBe('rice');
    expect(categorizeDish('牛肉麵')).toBe('noodle');
    expect(categorizeDish('貢丸湯')).toBe('soup');
    expect(categorizeDish('地瓜葉')).toBe('greens');
    expect(categorizeDish('燙青菜')).toBe('greens');
    expect(categorizeDish('豆干')).toBe('side');
    expect(categorizeDish('滷味')).toBe('side');
    expect(categorizeDish('珍珠奶茶')).toBe('drink');
    expect(categorizeDish('豆漿')).toBe('drink');
    expect(categorizeDish('蚵仔煎')).toBe('snack');
    expect(categorizeDish('鹹酥雞')).toBe('snack');
  });
  it('template categories are unique and non-empty', () => {
    const ids = MENU_TEMPLATE.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of MENU_TEMPLATE) expect(t.fillers.length).toBeGreaterThanOrEqual(5);
  });
});

describe('buildMenuExercise', () => {
  const pool = makePool();
  const food = pool.filter((c) => c.domain === 'food');

  it('builds a slip with every target placed in its category plus fillers', () => {
    const ex = buildMenuExercise(food, mulberry32(8))!;
    expect(ex).not.toBeNull();
    expect(ex.targets.length).toBeLessThanOrEqual(3);
    expect(ex.targets.length).toBeGreaterThanOrEqual(2);
    expect(ex.timeLimitMs).toBe(MENU_TIME_LIMIT_MS);
    const allItems = ex.categories.flatMap((c) => c.items);
    for (const target of ex.targets) {
      const item = allItems.find((i) => i.id === target.itemId)!;
      expect(item.cardId).toBe(target.cardId);
      expect(item.label).toBe(target.label);
      if (target.size) expect(item.sized).toBe(true);
      expect(target.key).toBe(selectionKey(item.id, target.size));
    }
    const labels = allItems.map((i) => i.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const category of ex.categories) {
      expect(category.items.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('prints a look-alike foil for each target in the same category', () => {
    const rice = pool[0]; // 滷肉飯 with foils 魯 / 鹵肉飯
    const ex = buildMenuExercise([rice, food[1]], mulberry32(9))!;
    const riceCategory = ex.categories.find((c) => c.id === 'rice')!;
    const foil = riceCategory.items.find((i) => i.foilOf === rice.id);
    expect(foil).toBeDefined();
    expect(['魯肉飯', '鹵肉飯']).toContain(foil!.label);
  });

  it('keeps the prompt free of pinyin', () => {
    const ex = buildMenuExercise(food, mulberry32(10))!;
    const prompt = formatOrderPrompt(ex.targets);
    expect(containsPinyin(prompt)).toBe(false);
    expect(prompt).toContain('、');
  });

  it('returns null without usable cards', () => {
    expect(buildMenuExercise([])).toBeNull();
    expect(buildMenuExercise([makeCard({ traditional: 'abc' })])).toBeNull();
  });
});

describe('gradeMenuExercise', () => {
  const pool = makePool();
  const food = pool.filter((c) => c.domain === 'food');
  const ex = buildMenuExercise(food, mulberry32(11))!;

  it('is all-correct when exactly the target boxes are ticked', () => {
    const grade = gradeMenuExercise(ex, new Set(ex.targets.map((t) => t.key)));
    expect(grade.allCorrect).toBe(true);
    expect(grade.missed).toEqual([]);
    expect(grade.wrongSelections).toEqual([]);
    for (const t of ex.targets) expect(grade.perCard[t.cardId]).toBe(true);
  });

  it('marks missed targets and extra ticks', () => {
    const [first, ...rest] = ex.targets;
    const extra = ex.categories.flatMap((c) => c.items).find((i) => !i.cardId && !i.foilOf)!;
    const selected = new Set([
      ...rest.map((t) => t.key),
      selectionKey(extra.id, extra.sized ? '小' : undefined),
    ]);
    const grade = gradeMenuExercise(ex, selected);
    expect(grade.allCorrect).toBe(false);
    expect(grade.perCard[first.cardId]).toBe(false);
    expect(grade.missed.map((t) => t.cardId)).toEqual([first.cardId]);
    expect(grade.wrongSelections).toHaveLength(1);
  });

  it('fails a target when its look-alike foil or wrong size is ticked too', () => {
    const items = ex.categories.flatMap((c) => c.items);
    const targetWithFoil = ex.targets.find((t) => items.some((i) => i.foilOf === t.cardId));
    if (targetWithFoil) {
      const foil = items.find((i) => i.foilOf === targetWithFoil.cardId)!;
      const selected = new Set(ex.targets.map((t) => t.key));
      selected.add(selectionKey(foil.id, foil.sized ? targetWithFoil.size : undefined));
      const grade = gradeMenuExercise(ex, selected);
      expect(grade.perCard[targetWithFoil.cardId]).toBe(false);
    }
    const sized = ex.targets.find((t) => t.size);
    if (sized) {
      const other = sized.size === '小' ? '大' : '小';
      const selected = new Set(ex.targets.map((t) => t.key));
      selected.add(selectionKey(sized.itemId, other));
      expect(gradeMenuExercise(ex, selected).perCard[sized.cardId]).toBe(false);
    }
  });
});
