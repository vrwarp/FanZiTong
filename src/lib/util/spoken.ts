import type { VocabCard } from '@/types';

/**
 * The reading the learner would hear for a word: the Taiwanese one when the
 * word is said that way, the pinyin when Mandarin is how it is usually said
 * (`spokenUse` 'also': 動畫 is dòng huà to nearly everyone, tōng-uē only from
 * a Taiwanese speaker) or when the card has no as-heard reading at all.
 */
export function readingOf(card: Pick<VocabCard, 'pinyin' | 'spoken' | 'spokenUse'>): string {
  return (spokenCue(card) ?? card.pinyin).trim();
}

/** The as-heard reading to cue with, or undefined when Mandarin is the usual way to say the word. */
export function spokenCue(card: Pick<VocabCard, 'spoken' | 'spokenUse'>): string | undefined {
  const spoken = card.spoken?.trim();
  if (!spoken || card.spokenUse === 'also') return undefined;
  return spoken;
}
