import { useEffect } from 'react';
import { Hanzi } from '@/components/ui/Hanzi';
import { DomainBadge } from '@/components/ui/Badge';
import type { RatingPreview } from '@/lib/fsrs/scheduler';
import type { RatingGrade, VocabCard } from '@/types';
import { RatingButtons } from './RatingButtons';

export interface RecognitionCardProps {
  card: VocabCard;
  revealed: boolean;
  previews: Record<RatingGrade, RatingPreview> | null;
  onReveal: () => void;
  onRate: (rating: RatingGrade) => void;
  /** 0 = manual tap only; >0 auto-reveals after that many ms. */
  autoRevealMs: number;
  position: number;
  total: number;
}

/**
 * Mode 1: Rapid Active Recognition. The prompt shows ONLY the Traditional
 * characters; pinyin and meaning are never rendered until the learner taps
 * (PRD §1.2, §5.1, AC-2).
 */
export function RecognitionCard({
  card,
  revealed,
  previews,
  onReveal,
  onRate,
  autoRevealMs,
  position,
  total,
}: RecognitionCardProps) {
  useEffect(() => {
    if (revealed || autoRevealMs <= 0) return;
    const id = window.setTimeout(onReveal, autoRevealMs);
    return () => window.clearTimeout(id);
  }, [card.id, revealed, autoRevealMs, onReveal]);

  const glyphSize =
    card.traditional.length <= 2
      ? 'text-7xl'
      : card.traditional.length <= 4
        ? 'text-6xl'
        : 'text-5xl';

  return (
    <div
      className="flex flex-1 flex-col gap-3"
      data-testid="recognition-card"
      data-card-id={card.id}
    >
      <div className="flex items-center justify-between text-sm text-stone-500 dark:text-stone-400">
        <DomainBadge domain={card.domain} />
        <span data-testid="session-progress">
          Card {position}/{total}
        </span>
      </div>

      <button
        type="button"
        onClick={onReveal}
        aria-label={revealed ? 'Answer revealed' : 'Tap to reveal pinyin and meaning'}
        data-testid="recognition-prompt"
        className="card-surface flex min-h-[38dvh] flex-1 items-center justify-center px-4 py-8 text-center active:bg-stone-50 dark:active:bg-ink-3"
      >
        <Hanzi
          data-testid="prompt-hanzi"
          className={`${glyphSize} font-bold leading-tight tracking-wide`}
        >
          {card.traditional}
        </Hanzi>
      </button>

      <div className="card-surface min-h-56 px-4 py-4" data-testid="answer-area" aria-live="polite">
        {revealed ? (
          <div className="flex flex-col gap-2">
            <p
              className="text-2xl font-semibold text-brand-700 dark:text-brand-300"
              data-testid="pinyin"
            >
              {card.pinyin}
            </p>
            <p className="text-lg" data-testid="definition">
              {card.definition}
            </p>
            {card.exampleSentenceTraditional && (
              <div className="mt-1 border-t border-stone-200 pt-2 text-sm dark:border-stone-700">
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  例句 · Example
                </p>
                <Hanzi className="block text-lg leading-relaxed" data-testid="example-sentence">
                  {card.exampleSentenceTraditional}
                </Hanzi>
                {card.exampleSentencePinyin && (
                  <p className="text-stone-600 dark:text-stone-300">{card.exampleSentencePinyin}</p>
                )}
                {card.exampleSentenceTranslation && (
                  <p className="text-stone-500 dark:text-stone-400">
                    {card.exampleSentenceTranslation}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-stone-600 dark:text-stone-300">
            <p className="text-sm font-medium">Recall the sound and meaning, then</p>
            <p className="text-sm font-semibold">tap the card to reveal Pinyin</p>
            {autoRevealMs > 0 && (
              <p className="mt-1 text-xs">auto-reveals in {Math.round(autoRevealMs / 1000)}s</p>
            )}
          </div>
        )}
      </div>

      <RatingButtons previews={previews} onRate={onRate} visible={revealed} />
    </div>
  );
}
