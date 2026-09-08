/**
 * Templates for the simulated Taiwanese order slip (PRD §5.3).
 *
 * Three shop types keep the slip coherent (a 滷肉飯 shop does not sell 蛋餅;
 * that is the 早餐店 next door). Filler items are authentic staples used as
 * distractors around the learner's own food-domain cards, with plausible
 * NT$ prices so reading the slip feels like standing at the counter.
 */
export type MenuCategoryId =
  | 'rice'
  | 'noodle'
  | 'soup'
  | 'greens'
  | 'side'
  | 'breakfast'
  | 'snack'
  | 'drink'
  | 'bento'
  | 'fruit'
  | 'sweet'
  /** Not something a slip can order (a sauce, a hot-pot night, a whole cuisine). */
  | 'other';

export type ShopType = 'rice-noodle' | 'breakfast' | 'night-market' | 'bento';

export interface MenuFiller {
  label: string;
  /** Price for unsized items, or [小, 大] for sized categories. */
  price: number | [number, number];
  pinyin: string;
  gloss: string;
  /** How people actually say it, when that is not the pinyin (Taiwanese readings). */
  spoken?: string;
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
  /** Sections this shop always prints. */
  categories: MenuCategoryId[];
  /** Sections it also sells, printed only when a dish from them is ordered. */
  alsoSells?: MenuCategoryId[];
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
      { label: '地瓜粥', price: [30, 45], pinyin: 'dì guā zhōu', gloss: 'sweet-potato congee' },
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
      { label: '米苔目', price: 45, pinyin: 'mǐ tāi mù', gloss: 'thick rice noodles' },
      { label: '冬粉', price: 40, pinyin: 'dōng fěn', gloss: 'glass noodles' },
      { label: '乾拌麵', price: [40, 55], pinyin: 'gān bàn miàn', gloss: 'dry tossed noodles' },
      { label: '陽春麵', price: [35, 45], pinyin: 'yáng chūn miàn', gloss: 'plain noodle soup' },
      {
        label: '牛肉湯麵',
        price: [60, 80],
        pinyin: 'niú ròu tāng miàn',
        gloss: 'noodles in beef broth (no beef)',
      },
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
      { label: '味噌魚湯', price: 55, pinyin: 'wèi cēng yú tāng', gloss: 'miso fish soup' },
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
      { label: '筊白筍', price: 55, pinyin: 'jiāo bái sǔn', gloss: 'water bamboo' },
      { label: '玉米筍', price: 45, pinyin: 'yù mǐ sǔn', gloss: 'baby corn' },
      { label: '涼拌茄子', price: 50, pinyin: 'liáng bàn qié zi', gloss: 'cold dressed aubergine' },
      { label: '醃蘿蔔', price: 30, pinyin: 'yān luó bo', gloss: 'pickled radish' },
      { label: '洋蔥圈', price: 45, pinyin: 'yáng cōng quān', gloss: 'onion rings' },
      {
        label: '番茄炒蛋',
        price: 60,
        pinyin: 'fān qié chǎo dàn',
        gloss: 'tomato with scrambled egg',
      },
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
      { label: '豬耳朵', price: 60, pinyin: 'zhū ěr duǒ', gloss: 'sliced pig ear' },
      { label: '馬鈴薯沙拉', price: 45, pinyin: 'mǎ líng shǔ shā lā', gloss: 'potato salad' },
      { label: '滷豆干', price: 20, pinyin: 'lǔ dòu gān', gloss: 'braised dried tofu' },
    ],
  },
  {
    id: 'breakfast',
    name: '主食',
    sized: false,
    defaultPrice: 40,
    fillers: [
      {
        label: '燒餅油條',
        price: 45,
        pinyin: 'shāo bǐng yóu tiáo',
        gloss: 'sesame flatbread around a dough stick',
      },
      { label: '熱壓吐司', price: 50, pinyin: 'rè yā tǔ sī', gloss: 'pressed toastie' },
      { label: '菜包', price: 30, pinyin: 'cài bāo', gloss: 'vegetable steamed bun' },
      { label: '狗不理包子', price: 55, pinyin: 'gǒu bù lǐ bāo zi', gloss: 'Goubuli steamed buns' },
      { label: '燒餅', price: 30, pinyin: 'shāo bǐng', gloss: 'baked sesame flatbread' },
      { label: '飯捲', price: 40, pinyin: 'fàn juǎn', gloss: 'rice roll (sushi-style)' },
      { label: '饅頭', price: 20, pinyin: 'mán tou', gloss: 'steamed bun' },
      { label: '漢堡', price: 45, pinyin: 'hàn bǎo', gloss: 'breakfast burger' },
      { label: '鮪魚飯糰', price: 45, pinyin: 'wěi yú fàn tuán', gloss: 'tuna rice roll' },
      { label: '芋頭糕', price: 35, pinyin: 'yù tóu gāo', gloss: 'taro cake' },
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
      { label: '蒸餃', price: 60, pinyin: 'zhēng jiǎo', gloss: 'steamed dumplings' },
      { label: '薯餅', price: 30, pinyin: 'shǔ bǐng', gloss: 'hash brown' },
      {
        label: '麻辣鴨血',
        price: 60,
        pinyin: 'má là yā xiě',
        gloss: 'duck blood curd in chilli broth',
      },
      {
        label: '甜辣魷魚',
        price: 70,
        pinyin: 'tián là yóu yú',
        gloss: 'squid in sweet chilli sauce',
      },
      { label: '甜不辣', price: 50, pinyin: 'tián bù là', gloss: 'tempura fish cake' },
      {
        label: '大腸包小腸',
        price: 70,
        pinyin: 'dà cháng bāo xiǎo cháng',
        gloss: 'sticky-rice sausage wrap',
      },
      {
        label: '碗粿',
        price: 40,
        pinyin: 'wǎn guǒ',
        gloss: 'savoury rice pudding',
        spoken: 'uánn-kué',
      },
      {
        label: '蚵仔煎',
        price: 70,
        pinyin: 'kē zǎi jiān',
        gloss: 'oyster omelette',
        spoken: 'ô-á-tsian',
      },
      {
        label: '蚵仔麵線',
        price: 60,
        pinyin: 'kē zǎi miàn xiàn',
        gloss: 'oyster vermicelli',
        spoken: 'ô-á-mī-suànn',
      },
      { label: '臭豆腐', price: 60, pinyin: 'chòu dòu fǔ', gloss: 'stinky tofu' },
      {
        label: '肉圓',
        price: 50,
        pinyin: 'ròu yuán',
        gloss: 'Taiwanese meatball',
        spoken: 'bah-uân',
      },
      { label: '鹹酥雞', price: 70, pinyin: 'xián sū jī', gloss: 'popcorn chicken' },
      { label: '蚵嗲', price: 45, pinyin: 'kē diē', gloss: 'oyster fritter', spoken: 'ô-te' },
      { label: '排骨酥', price: 60, pinyin: 'pái gǔ sū', gloss: 'crispy fried pork ribs' },
      { label: '雞排', price: 70, pinyin: 'jī pái', gloss: 'fried chicken cutlet' },
      { label: '鹹水雞', price: 80, pinyin: 'xián shuǐ jī', gloss: 'brined chicken' },
      { label: '炸豆腐', price: 40, pinyin: 'zhà dòu fǔ', gloss: 'fried tofu' },
      { label: '肉粽', price: 45, pinyin: 'ròu zòng', gloss: 'pork rice dumpling' },
    ],
  },
  {
    id: 'drink',
    name: '飲料',
    sized: false,
    defaultPrice: 30,
    fillers: [
      { label: '紅茶', price: 25, pinyin: 'hóng chá', gloss: 'black tea' },
      { label: '冬瓜茶', price: 25, pinyin: 'dōng guā chá', gloss: 'winter-melon tea' },
      { label: '青草茶', price: 25, pinyin: 'qīng cǎo chá', gloss: 'herbal tea' },
      { label: '楊桃汁', price: 30, pinyin: 'yáng táo zhī', gloss: 'starfruit juice' },
      { label: '米漿', price: 25, pinyin: 'mǐ jiāng', gloss: 'peanut rice milk' },
      { label: '鮮奶茶', price: 60, pinyin: 'xiān nǎi chá', gloss: 'fresh milk tea' },
      { label: '珍珠奶茶', price: 55, pinyin: 'zhēn zhū nǎi chá', gloss: 'bubble milk tea' },
      { label: '豆漿', price: 25, pinyin: 'dòu jiāng', gloss: 'soy milk' },
    ],
  },
  {
    id: 'bento',
    name: '便當類',
    sized: false,
    defaultPrice: 90,
    fillers: [
      { label: '排骨便當', price: 90, pinyin: 'pái gǔ biàn dāng', gloss: 'pork-chop lunchbox' },
      { label: '雞腿便當', price: 100, pinyin: 'jī tuǐ biàn dāng', gloss: 'chicken-leg lunchbox' },
      {
        label: '焢肉便當',
        price: 95,
        pinyin: 'kòng ròu biàn dāng',
        gloss: 'braised pork-belly lunchbox',
      },
      { label: '魚排便當', price: 90, pinyin: 'yú pái biàn dāng', gloss: 'fish-fillet lunchbox' },
      { label: '素食便當', price: 80, pinyin: 'sù shí biàn dāng', gloss: 'vegetarian lunchbox' },
    ],
  },
  {
    // A night market has a fruit stall and a dessert stall, and a learner meets
    // 芒果 and 豆花 standing at one. Before this they fell into 小菜, where
    // nothing on the counter was anything like them.
    id: 'fruit',
    name: '水果',
    sized: false,
    defaultPrice: 60,
    fillers: [
      { label: '切盤水果', price: 80, pinyin: 'qiē pán shuǐ guǒ', gloss: 'a cut fruit platter' },
      { label: '芭樂', price: 50, pinyin: 'bā lè', gloss: 'guava', spoken: 'pua̍t-á' },
      { label: '蓮霧', price: 70, pinyin: 'lián wù', gloss: 'wax apple' },
      { label: '釋迦', price: 90, pinyin: 'shì jiā', gloss: 'sugar apple' },
      { label: '荔枝', price: 80, pinyin: 'lì zhī', gloss: 'lychee' },
      { label: '楊桃', price: 55, pinyin: 'yáng táo', gloss: 'starfruit' },
      { label: '哈密瓜', price: 90, pinyin: 'hā mì guā', gloss: 'honeydew melon' },
      { label: '柳丁', price: 45, pinyin: 'liǔ dīng', gloss: 'orange' },
      { label: '水梨', price: 75, pinyin: 'shuǐ lí', gloss: 'Asian pear' },
      { label: '香瓜', price: 60, pinyin: 'xiāng guā', gloss: 'muskmelon' },
      { label: '葡萄柚', price: 65, pinyin: 'pú táo yòu', gloss: 'grapefruit' },
      { label: '椰子水', price: 60, pinyin: 'yé zi shuǐ', gloss: 'coconut water' },
      { label: '檸檬愛玉', price: 50, pinyin: 'níng méng ài yù', gloss: 'aiyu jelly with lemon' },
      {
        label: '番茄切盤',
        price: 60,
        pinyin: 'fān qié qiē pán',
        gloss: 'sliced tomato with ginger',
      },
      { label: '芒果冰', price: 100, pinyin: 'máng guǒ bīng', gloss: 'shaved ice with mango' },
      { label: '鳳梨酥', price: 40, pinyin: 'fèng lí sū', gloss: 'pineapple cake' },
      { label: '香蕉牛奶', price: 55, pinyin: 'xiāng jiāo niú nǎi', gloss: 'banana milk' },
      { label: '酪梨牛奶', price: 75, pinyin: 'luò lí niú nǎi', gloss: 'avocado milkshake' },
      { label: '文旦柚', price: 80, pinyin: 'wén dàn yòu', gloss: 'wendan pomelo' },
    ],
  },
  {
    id: 'sweet',
    name: '甜點',
    sized: false,
    defaultPrice: 45,
    fillers: [
      { label: '芝麻球', price: 35, pinyin: 'zhī má qiú', gloss: 'sesame ball' },
      { label: '布丁', price: 35, pinyin: 'bù dīng', gloss: 'crème caramel' },
      { label: '仙草凍', price: 45, pinyin: 'xiān cǎo dòng', gloss: 'grass jelly' },
      { label: '芋圓', price: 55, pinyin: 'yù yuán', gloss: 'taro balls' },
      { label: '花生湯圓', price: 55, pinyin: 'huā shēng tāng yuán', gloss: 'peanut rice balls' },
      { label: '紅豆餅', price: 20, pinyin: 'hóng dòu bǐng', gloss: 'red bean wheel cake' },
      { label: '雞蛋糕', price: 40, pinyin: 'jī dàn gāo', gloss: 'egg cakelets' },
      { label: '麥芽糖', price: 30, pinyin: 'mài yá táng', gloss: 'maltose on a cracker' },
      { label: '牛軋糖', price: 60, pinyin: 'niú gá táng', gloss: 'nougat' },
      { label: '巧克力棒', price: 35, pinyin: 'qiǎo kè lì bàng', gloss: 'a chocolate stick' },
      { label: '烤地瓜', price: 50, pinyin: 'kǎo dì guā', gloss: 'roast sweet potato' },
      {
        label: '花生捲冰淇淋',
        price: 55,
        pinyin: 'huā shēng juǎn bīng qí lín',
        gloss: 'peanut ice-cream roll',
      },
      { label: '甜甜圈', price: 35, pinyin: 'tián tián quān', gloss: 'doughnut' },
      { label: '蜂蜜蛋糕', price: 60, pinyin: 'fēng mì dàn gāo', gloss: 'honey castella' },
      { label: '杏仁豆腐', price: 45, pinyin: 'xìng rén dòu fǔ', gloss: 'almond tofu' },
      { label: '月光餅', price: 40, pinyin: 'yuè guāng bǐng', gloss: 'a moon-shaped pastry' },
      { label: '點心盤', price: 60, pinyin: 'diǎn xīn pán', gloss: 'a plate of small sweets' },
      {
        label: '棉花糖串',
        price: 30,
        pinyin: 'mián huā táng chuàn',
        gloss: 'candy floss on a stick',
      },
      { label: '果凍杯', price: 25, pinyin: 'guǒ dòng bēi', gloss: 'a cup of jelly' },
    ],
  },
];

export const SHOP_TEMPLATES: Record<ShopType, ShopTemplate> = {
  'rice-noodle': {
    type: 'rice-noodle',
    name: '阿婆小吃店',
    categories: ['rice', 'noodle', 'soup', 'side'],
    alsoSells: ['greens'],
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
    alsoSells: ['fruit', 'sweet'],
  },
  bento: {
    type: 'bento',
    name: '巷口便當店',
    categories: ['bento', 'soup', 'drink'],
  },
};

/** The shops that sell a category (printed core sections plus the ones they also stock). */
export function shopsFor(category: MenuCategoryId): ShopType[] {
  return (Object.values(SHOP_TEMPLATES) as ShopTemplate[])
    .filter((s) => s.categories.includes(category) || (s.alsoSells ?? []).includes(category))
    .map((s) => s.type);
}

export function categoryTemplate(id: MenuCategoryId): MenuCategoryTemplate {
  return MENU_CATEGORIES.find((c) => c.id === id)!;
}

const BREAKFAST_RE =
  /(蛋餅|蘿蔔糕|飯糰|吐司|漢堡|三明治|抓餅|鐵板麵|燒餅|油條|熱狗|包子|肉包|菜包)/;
const SNACK_RE = /(煎|圓|雞|豆腐|甜不辣|包小腸|粿|嗲|排|串|餃|粽|薯條|羹)/;
const FRUIT_RE = /(瓜|果|梨|蕉|桃|柚|旦|椰|檸|莓|葡萄|荔枝|蓮霧|釋迦|芭樂|柳丁|番茄|水果)/;
const GREENS_RE = /([菜葉筍芽蔥椒茄]|蘿蔔|玉米|地瓜|苦瓜|冬瓜|絲瓜|黃瓜|南瓜)/;
const SWEET_RE = /(糖|糕|凍|布丁|甜點|點心|冰淇淋|巧克力|愛玉|仙草|月餅|麻糬|豆花|甜甜圈)/;
/**
 * Words that name food without naming a dish.
 *
 * 美食, 素食, 中餐 and 海鮮 are food vocabulary a learner wants, but no counter
 * will take an order for one, and putting them on a slip meant looking for a
 * neighbouring dish that could never exist. They stay in the deck and stay off
 * the menu.
 */
const NOT_A_DISH_RE =
  /^(美食|素食|食品|中餐|小吃|日料|日本料理|料理|海鮮|水產|海產|糧食|油脂|乳酪|奶油|麻油|豬油|沙拉油|橄欖油|佛跳牆|天婦羅|天麩羅|米飯|白米|小米|大麥|生魚片|魚生|魚肉|牛肉|豬肉|羊肉|瘦肉|精肉|鮮肉|滷肉|魚鮮|豆腐渣)$/;

/** Heuristically place a dish name into a slip category by its characters. */
export function categorizeDish(name: string): MenuCategoryId {
  if (NOT_A_DISH_RE.test(name) || /火鍋|醬$/.test(name)) return 'other';
  if (/便當/.test(name)) return 'bento';
  if (BREAKFAST_RE.test(name)) return 'breakfast';
  if (/[茶漿奶汁]/.test(name)) return 'drink';
  if (/湯$/.test(name)) return 'soup';
  if (SWEET_RE.test(name)) return 'sweet';
  if (/[麵粉]/.test(name)) return 'noodle';
  if (/[飯粥]/.test(name)) return 'rice';
  // Greens before fruit, because a 瓜 is not always a fruit: 地瓜葉 and 苦瓜
  // grow on the vegetable counter and 西瓜 does not.
  if (GREENS_RE.test(name)) return 'greens';
  if (FRUIT_RE.test(name)) return 'fruit';
  if (SNACK_RE.test(name)) return 'snack';
  return 'side';
}

const SHOP_PRIORITY: ShopType[] = ['rice-noodle', 'breakfast', 'night-market', 'bento'];

/** The shop that sells the most of these dishes (a 滷肉飯 counter first on a tie). */
export function chooseShopType(categories: MenuCategoryId[]): ShopType {
  let best: ShopType = 'rice-noodle';
  let bestCount = -1;
  for (const type of SHOP_PRIORITY) {
    const count = categories.filter((c) => shopsFor(c).includes(type)).length;
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best;
}

/** What a dish actually costs at the counter; jitter only applies to the rest. */
const PRICE_TABLE: Record<string, number | [number, number]> = {
  便當: 90,
  珍珠奶茶: 55,
  鮮奶茶: 60,
  豆漿: 25,
  米漿: 25,
  紅茶: 25,
  蛋餅: 35,
  排骨: 90,
  牛肉麵: [130, 160],
  乾麵: [40, 55],
};

/** Deterministic small price jitter so the same dish always costs the same. */
export function priceFor(
  label: string,
  base: number | [number, number],
): number | [number, number] {
  const fixed = PRICE_TABLE[label];
  if (fixed !== undefined) return fixed;
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  const jitter = (hash % 3) * 5; // 0, 5 or 10 NT$
  if (Array.isArray(base)) return [base[0] + jitter, base[1] + jitter];
  return base + jitter;
}
