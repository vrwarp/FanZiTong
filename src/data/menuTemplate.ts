/**
 * Template for the simulated Taiwanese 小吃店 order slip (PRD §5.3).
 * Filler items are authentic menu staples used as distractors around the
 * learner's own food-domain cards.
 */
export type MenuCategoryId = 'rice' | 'noodle' | 'soup' | 'greens' | 'side' | 'snack' | 'drink';

export interface MenuCategoryTemplate {
  id: MenuCategoryId;
  /** Heading printed on the slip, e.g. 飯類. */
  name: string;
  /** Whether items in this category come in 小 / 大 sizes. */
  sized: boolean;
  fillers: string[];
}

export const MENU_SIZES = ['小', '大'] as const;
export type MenuSize = (typeof MENU_SIZES)[number];

export const MENU_TEMPLATE: MenuCategoryTemplate[] = [
  {
    id: 'rice',
    name: '飯類',
    sized: true,
    fillers: ['滷肉飯', '雞肉飯', '排骨飯', '焢肉飯', '肉燥飯', '蝦仁炒飯', '咖哩飯', '鴨肉飯'],
  },
  {
    id: 'noodle',
    name: '麵類',
    sized: true,
    fillers: ['牛肉麵', '乾麵', '陽春麵', '榨菜肉絲麵', '麻醬麵', '餛飩麵', '鍋燒意麵', '炒麵'],
  },
  {
    id: 'soup',
    name: '湯類',
    sized: false,
    fillers: ['貢丸湯', '餛飩湯', '蛋花湯', '魚丸湯', '味噌湯', '酸辣湯', '紫菜湯', '蛤蜊湯'],
  },
  {
    id: 'greens',
    name: '燙青菜',
    sized: false,
    fillers: ['地瓜葉', '空心菜', '高麗菜', '青江菜', '大陸妹', '龍鬚菜', '豆芽菜', '菠菜'],
  },
  {
    id: 'side',
    name: '小菜',
    sized: false,
    fillers: ['滷蛋', '豆干', '海帶', '皮蛋豆腐', '涼拌小黃瓜', '油豆腐', '燙花枝', '嘴邊肉'],
  },
  {
    id: 'snack',
    name: '小吃',
    sized: false,
    fillers: ['蚵仔煎', '臭豆腐', '肉圓', '蘿蔔糕', '鹹酥雞', '蛋餅', '甜不辣', '碗粿'],
  },
  {
    id: 'drink',
    name: '飲料',
    sized: false,
    fillers: ['珍珠奶茶', '豆漿', '紅茶', '冬瓜茶', '青草茶', '楊桃汁', '米漿', '綠茶'],
  },
];

/** Heuristically place a dish name into a slip category by its characters. */
export function categorizeDish(name: string): MenuCategoryId {
  if (/[茶漿奶汁]/.test(name)) return 'drink';
  if (/湯$/.test(name)) return 'soup';
  if (/麵/.test(name)) return 'noodle';
  if (/[飯糰粥]/.test(name)) return 'rice';
  if (/[菜葉筍芽]/.test(name)) return 'greens';
  if (/[蛋干腐帶味]/.test(name) && !/[煎糕雞]/.test(name)) return 'side';
  return 'snack';
}
