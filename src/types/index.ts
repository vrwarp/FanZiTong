/**
 * Core domain types for 繁字通 (FanZiTong).
 *
 * These mirror the PRD data models (§3) exactly, with a few additive,
 * optional fields where the underlying scheduler (ts-fsrs) needs them.
 */

export const DOMAIN_CATEGORIES = ['food', 'church', 'slang', 'anime', 'custom'] as const;
export type DomainCategory = (typeof DOMAIN_CATEGORIES)[number];

export const DOMAIN_LABELS: Record<DomainCategory, { en: string; zh: string; emoji: string }> = {
  food: { en: 'Food', zh: '飲食', emoji: '🍜' },
  church: { en: 'Church', zh: '教會', emoji: '⛪' },
  slang: { en: 'Slang', zh: '流行語', emoji: '💬' },
  anime: { en: 'Anime', zh: '動漫', emoji: '🎌' },
  custom: { en: 'Custom', zh: '自訂', emoji: '📝' },
};

export function isDomainCategory(value: unknown): value is DomainCategory {
  return typeof value === 'string' && (DOMAIN_CATEGORIES as readonly string[]).includes(value);
}

/** FSRS card memory state: 0 New, 1 Learning, 2 Review, 3 Relearning. */
export const CardState = {
  New: 0,
  Learning: 1,
  Review: 2,
  Relearning: 3,
} as const;
export type CardStateValue = (typeof CardState)[keyof typeof CardState];

export const CARD_STATE_LABELS: Record<CardStateValue, string> = {
  0: 'New',
  1: 'Learning',
  2: 'Review',
  3: 'Relearning',
};
/** The same four states in Chinese, so every screen uses one vocabulary. */
export const CARD_STATE_ZH: Record<CardStateValue, string> = {
  0: '新',
  1: '學習中',
  2: '複習中',
  3: '重學',
};

export interface FsrsState {
  /** ISO timestamp for next scheduled review. */
  due: string;
  /** Days until retention drops below target. */
  stability: number;
  /** Inherent card difficulty (1-10). */
  difficulty: number;
  /** Days since last review. */
  elapsed_days: number;
  /** Calculated interval to next review. */
  scheduled_days: number;
  /** Total number of reviews. */
  reps: number;
  /** Number of times card was rated "Again". */
  lapses: number;
  /** 0: New, 1: Learning, 2: Review, 3: Relearning. */
  state: number;
  /** ISO timestamp of last review. */
  last_review?: string;
  /** Current (re)learning step index, tracked by ts-fsrs. */
  learning_steps?: number;
}

export interface VocabCard {
  /** UUID v4 */
  id: string;
  /** e.g. "滷肉飯", "團契", "傲嬌" */
  traditional: string;
  /** Tone-marked Hanyu Pinyin, e.g. "lǔ ròu fàn" */
  pinyin: string;
  /**
   * How the word is actually said when the dictionary reading is not what
   * people use (Taiwanese: 蚵仔煎 → "ô-á-chian", 肉圓 → "bah-oân"). Used as the
   * primary cue in drills and shown first on the reveal when present.
   */
  spoken?: string;
  /** English and/or vernacular definition */
  definition: string;
  domain: DomainCategory;
  tags: string[];
  exampleSentenceTraditional?: string;
  exampleSentencePinyin?: string;
  exampleSentenceTranslation?: string;
  /** Visually confusable characters/words for discrimination drills. */
  visualFoils?: string[];
  /**
   * Accepted alternative spellings seen in the wild (e.g. 滷肉飯 → 魯肉飯,
   * 鹹酥雞 → 鹽酥雞). Never used as "wrong" foils; shown as "also written".
   */
  variants?: string[];
  /** Free-text note about the variants, e.g. "借口 is the China-side spelling". */
  variantNote?: string;
  /** Authored readable-but-wrong options for the cloze; the generator fills the rest. */
  clozeDistractors?: string[];
  fsrs: FsrsState;
  createdAt: string;
  updatedAt: string;
}

/** 1: Again, 2: Hard, 3: Good, 4: Easy */
export type RatingGrade = 1 | 2 | 3 | 4;
export const RATING_LABELS: Record<RatingGrade, string> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
};

export type ExerciseType = 'rapid_recognition' | 'cloze' | 'realia_menu' | 'foil_discrimination';
/** One plain name per exercise, used everywhere it appears. */
export const EXERCISE_LABELS: Record<ExerciseType, { en: string; zh: string }> = {
  rapid_recognition: { en: 'Recognition', zh: '認字' },
  cloze: { en: 'Fill the Blank', zh: '填空' },
  realia_menu: { en: 'Order Slip', zh: '點菜單' },
  foil_discrimination: { en: 'Spot the Character', zh: '辨字' },
};

export interface ReviewLog {
  id: string;
  cardId: string;
  rating: RatingGrade;
  exerciseType: ExerciseType;
  reviewTimestamp: string;
  timeSpentMs: number;
  /** FSRS state of the card before this answer (0 New, 1 Learning, 2 Review, 3 Relearning). */
  stateBefore?: number;
  // Snapshot of FSRS state after the review.
  stability: number;
  difficulty: number;
  scheduled_days: number;
  lapses: number;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserSettings {
  /** Target probability of recall (0-1). Default 0.90. */
  targetRetention: number;
  maxDailyReviews: number;
  maxDailyNewCards: number;
  /** Lapses at/above which a card is flagged as a leech. */
  leechThreshold: number;
  /** 0 = manual tap only; >0 = auto reveal after this many ms. */
  pinyinRevealDelayMs: number;
  activeDomains: DomainCategory[];
  theme: ThemePreference;
}

export const DEFAULT_SETTINGS: UserSettings = {
  targetRetention: 0.9,
  maxDailyReviews: 30,
  maxDailyNewCards: 10,
  leechThreshold: 3,
  pinyinRevealDelayMs: 0,
  activeDomains: ['food', 'church', 'slang', 'anime', 'custom'],
  theme: 'system',
};

/** Standard JSON deck format (PRD §7.1) with optional full-backup extras. */
export interface DeckExport {
  version: '1.0';
  exportedAt: string;
  deckName: string;
  cards: VocabCard[];
  reviewLogs?: ReviewLog[];
  settings?: UserSettings;
}
