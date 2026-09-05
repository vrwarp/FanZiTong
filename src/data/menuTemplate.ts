/**
 * Templates for the simulated Taiwanese order slip (PRD §5.3).
 *
 * Three shop types keep the slip coherent (a 滷肉飯 shop does not sell 蛋餅;
 * that is the 早餐店 next door). Filler items are authentic staples used as
 * distractors around the learner's own food-domain cards, with plausible
 * NT$ prices so reading the slip feels like standing at the counter.
 */
export type MenuCategoryId =
  'rice' | 'noodle' | 'soup' | 'greens' | 'side' | 'breakfast' | 'snack' | 'drink';

export type ShopType = 'rice-noodle' | 'breakfast' | 'night-market';

export interface MenuFiller {
  label: string;
  /** Price for unsized items, or [小, 大] for sized categories. */
  price: number | [number, number];
  pinyin: string;
  gloss: string;
}

export interface MenuCategoryTemplate {
  id: MenuCategoryId;
  /** Heading printed on the slip, e.g. 飯類. */
  name: string;
  /** Whether items in this category come in 小 / 大 sizes. */
  sized: boolean;
  /** Default price range used for the learner's own cards placed here. */
  defaultPrice: number | [number, number];
  fillers: MenuFiller[];
}

export interface ShopTemplate {
  type: ShopType;
  /** Printed at the top of the slip. */
  name: string;
  categories: MenuCategoryId[];
}

export const MENU_SIZES = ['小', '大'] as const;
export type MenuSize = (typeof MENU_SIZES)[number];

export const MENU_CATEGORIES: MenuCategoryTemplate[] = [
  {
    id: 'rice',
    name: '飯類',
    sized: true,
    defaultPrice: [35, 50],
    fillers: [
      { label: '雞肉飯', price: [35, 50], pinyin: 'jī ròu fàn', gloss: 'shredded chicken rice' },
      { label: '排骨飯', price: [90, 110], pinyin: 'pái gǔ fàn', gloss: 'pork-chop rice' },
      {
        label: '焢肉飯',
        price: [60, 80],
        pinyin: 'kòng ròu fàn',
        gloss: 'braised pork-belly rice',
      },
      { label: '肉燥飯', price: [30, 45], pinyin: 'ròu zào fàn', gloss: 'minced-pork sauce rice' },
      {
        label: '蝦仁炒飯',
        price: [80, 100],
        pinyin: 'xiā rén chǎo fàn',
        gloss: 'shrimp fried rice',
      },
      { label: '咖哩飯', price: [75, 95], pinyin: 'gā lǐ fàn', gloss: 'curry rice' },
      { label: '鴨肉飯', price: [45, 60], pinyin: 'yā ròu fàn', gloss: 'duck rice' },
    ],
  },
  {
    id: 'noodle',
    name: '麵類',
    sized: true,
    defaultPrice: [45, 60],
    fillers: [
      { label: '陽春麵', price: [35, 45], pinyin: 'yáng chūn miàn', gloss: 'plain noodle soup' },
      {
        label: '榨菜肉絲麵',
        price: [60, 75],
        pinyin: 'zhà cài ròu sī miàn',
        gloss: 'pickled-mustard pork noodles',
      },
      { label: '麻醬麵', price: [45, 55], pinyin: 'má jiàng miàn', gloss: 'sesame-paste noodles' },
      { label: '餛飩麵', price: [60, 75], pinyin: 'hún tun miàn', gloss: 'wonton noodles' },
      {
        label: '鍋燒意麵',
        price: [80, 95],
        pinyin: 'guō shāo yì miàn',
        gloss: 'pot-cooked yi noodles',
      },
      { label: '炒麵', price: [50, 65], pinyin: 'chǎo miàn', gloss: 'fried noodles' },
      {
        label: '大滷麵',
        price: [65, 80],
        pinyin: 'dà lǔ miàn',
        gloss: 'thick braised-soup noodles',
      },
    ],
  },
  {
    id: 'soup',
    name: '湯類',
    sized: false,
    defaultPrice: 30,
    fillers: [
      { label: '蛋花湯', price: 25, pinyin: 'dàn huā tāng', gloss: 'egg-drop soup' },
      { label: '魚丸湯', price: 30, pinyin: 'yú wán tāng', gloss: 'fish-ball soup' },
      { label: '味噌湯', price: 25, pinyin: 'wèi zēng tāng', gloss: 'miso soup' },
      { label: '酸辣湯', price: 35, pinyin: 'suān là tāng', gloss: 'hot-and-sour soup' },
      { label: '紫菜湯', price: 25, pinyin: 'zǐ cài tāng', gloss: 'seaweed soup' },
      { label: '蛤蜊湯', price: 60, pinyin: 'gé lí tāng', gloss: 'clam soup' },
      {
        label: '苦瓜排骨湯',
        price: 70,
        pinyin: 'kǔ guā pái gǔ tāng',
        gloss: 'bitter-melon pork-rib soup',
      },
    ],
  },
  {
    id: 'greens',
    name: '燙青菜',
    sized: false,
    defaultPrice: 35,
    fillers: [
      { label: '空心菜', price: 35, pinyin: 'kōng xīn cài', gloss: 'water spinach' },
      { label: '高麗菜', price: 35, pinyin: 'gāo lì cài', gloss: 'cabbage' },
      { label: '青江菜', price: 35, pinyin: 'qīng jiāng cài', gloss: 'bok choy' },
      { label: '大陸妹', price: 40, pinyin: 'dà lù mèi', gloss: 'lettuce (Taiwan menu name)' },
      { label: '龍鬚菜', price: 45, pinyin: 'lóng xū cài', gloss: 'chayote shoots' },
      { label: '豆芽菜', price: 30, pinyin: 'dòu yá cài', gloss: 'bean sprouts' },
      { label: '菠菜', price: 40, pinyin: 'bō cài', gloss: 'spinach' },
    ],
  },
  {
    id: 'side',
    name: '小菜',
    sized: false,
    defaultPrice: 30,
    fillers: [
      { label: '滷蛋', price: 15, pinyin: 'lǔ dàn', gloss: 'braised egg' },
      { label: '海帶', price: 25, pinyin: 'hǎi dài', gloss: 'kelp' },
      { label: '皮蛋豆腐', price: 40, pinyin: 'pí dàn dòu fǔ', gloss: 'century-egg tofu' },
      {
        label: '涼拌小黃瓜',
        price: 35,
        pinyin: 'liáng bàn xiǎo huáng guā',
        gloss: 'cold cucumber salad',
      },
      { label: '油豆腐', price: 25, pinyin: 'yóu dòu fǔ', gloss: 'fried tofu' },
      { label: '燙花枝', price: 80, pinyin: 'tàng huā zhī', gloss: 'blanched cuttlefish' },
      { label: '嘴邊肉', price: 70, pinyin: 'zuǐ biān ròu', gloss: 'pork cheek' },
    ],
  },
  {
    id: 'breakfast',
    name: '主食',
    sized: false,
    defaultPrice: 40,
    fillers: [
      { label: '鐵板麵', price: 55, pinyin: 'tiě bǎn miàn', gloss: 'iron-plate noodles' },
      { label: '蔥抓餅', price: 35, pinyin: 'cōng zhuā bǐng', gloss: 'scallion pancake' },
      { label: '總匯三明治', price: 55, pinyin: 'zǒng huì sān míng zhì', gloss: 'club sandwich' },
      { label: '火腿蛋吐司', price: 40, pinyin: 'huǒ tuǐ dàn tǔ sī', gloss: 'ham-and-egg toast' },
      { label: '豬排漢堡', price: 60, pinyin: 'zhū pái hàn bǎo', gloss: 'pork-chop burger' },
      { label: '厚片吐司', price: 30, pinyin: 'hòu piàn tǔ sī', gloss: 'thick toast' },
      { label: '蛋餅', price: 35, pinyin: 'dàn bǐng', gloss: 'egg crepe' },
      { label: '蘿蔔糕', price: 35, pinyin: 'luó bo gāo', gloss: 'turnip cake' },
      { label: '飯糰', price: 45, pinyin: 'fàn tuán', gloss: 'rice roll' },
    ],
  },
  {
    id: 'snack',
    name: '小吃',
    sized: false,
    defaultPrice: 60,
    fillers: [
      { label: '甜不辣', price: 50, pinyin: 'tián bù là', gloss: 'tempura fish cake' },
      {
        label: '大腸包小腸',
        price: 70,
        pinyin: 'dà cháng bāo xiǎo cháng',
        gloss: 'sticky-rice sausage wrap',
      },
      { label: '碗粿', price: 40, pinyin: 'wǎn guǒ', gloss: 'savoury rice pudding' },
      { label: '蚵仔煎', price: 70, pinyin: 'kē zǎi jiān', gloss: 'oyster omelette' },
      { label: '臭豆腐', price: 60, pinyin: 'chòu dòu fǔ', gloss: 'stinky tofu' },
      { label: '肉圓', price: 50, pinyin: 'ròu yuán', gloss: 'Taiwanese meatball' },
      { label: '鹹酥雞', price: 70, pinyin: 'xián sū jī', gloss: 'popcorn chicken' },
      { label: '蚵嗲', price: 45, pinyin: 'kē diē', gloss: 'oyster fritter' },
    ],
  },
  {
    id: 'drink',
    name: '飲料',
    sized: false,
    defaultPrice: 30,
    fillers: [
      { label: '紅茶', price: 20, pinyin: 'hóng chá', gloss: 'black tea' },
      { label: '冬瓜茶', price: 25, pinyin: 'dōng guā chá', gloss: 'winter-melon tea' },
      { label: '青草茶', price: 25, pinyin: 'qīng cǎo chá', gloss: 'herbal tea' },
      { label: '楊桃汁', price: 30, pinyin: 'yáng táo zhī', gloss: 'starfruit juice' },
      { label: '米漿', price: 20, pinyin: 'mǐ jiāng', gloss: 'peanut rice milk' },
      { label: '鮮奶茶', price: 35, pinyin: 'xiān nǎi chá', gloss: 'fresh milk tea' },
      { label: '珍珠奶茶', price: 40, pinyin: 'zhēn zhū nǎi chá', gloss: 'bubble milk tea' },
      { label: '豆漿', price: 20, pinyin: 'dòu jiāng', gloss: 'soy milk' },
    ],
  },
];

export const SHOP_TEMPLATES: Record<ShopType, ShopTemplate> = {
  'rice-noodle': {
    type: 'rice-noodle',
    name: '阿婆小吃店',
    categories: ['rice', 'noodle', 'soup', 'side'],
  },
  breakfast: {
    type: 'breakfast',
    name: '阿姨早餐店',
    categories: ['breakfast', 'drink'],
  },
  'night-market': {
    type: 'night-market',
    name: '夜市小吃攤',
    categories: ['snack', 'drink'],
  },
};

export function categoryTemplate(id: MenuCategoryId): MenuCategoryTemplate {
  return MENU_CATEGORIES.find((c) => c.id === id)!;
}

const BREAKFAST_RE = /(蛋餅|蘿蔔糕|飯糰|吐司|漢堡|三明治|抓餅|鐵板麵|燒餅|油條)/;
const SNACK_RE = /(煎|圓|雞|豆腐|甜不辣|包小腸|粿|嗲|排|串)/;

/** Heuristically place a dish name into a slip category by its characters. */
export function categorizeDish(name: string): MenuCategoryId {
  if (BREAKFAST_RE.test(name)) return 'breakfast';
  if (/[茶漿奶汁]/.test(name)) return 'drink';
  if (/湯$/.test(name)) return 'soup';
  if (/麵/.test(name)) return 'noodle';
  if (/[飯粥]/.test(name)) return 'rice';
  if (/[菜葉筍芽]/.test(name)) return 'greens';
  if (SNACK_RE.test(name)) return 'snack';
  return 'side';
}

/** Choose the kind of shop that would plausibly print all of these dishes. */
export function chooseShopType(categories: MenuCategoryId[]): ShopType {
  const counts = new Map<MenuCategoryId, number>();
  for (const c of categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  const n = Math.max(1, categories.length);
  if ((counts.get('breakfast') ?? 0) / n >= 0.5) return 'breakfast';
  if ((counts.get('snack') ?? 0) / n >= 0.5) return 'night-market';
  return 'rice-noodle';
}

/** Deterministic small price jitter so the same dish always costs the same. */
export function priceFor(
  label: string,
  base: number | [number, number],
): number | [number, number] {
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  const jitter = (hash % 3) * 5; // 0, 5 or 10 NT$
  if (Array.isArray(base)) return [base[0] + jitter, base[1] + jitter];
  return base + jitter;
}
