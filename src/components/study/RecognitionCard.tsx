import { useEffect, useState } from 'react';
import { Hanzi } from '@/components/ui/Hanzi';
import { DomainBadge } from '@/components/ui/Badge';
import type { RatingPreview } from '@/lib/fsrs/scheduler';
import { cn } from '@/lib/util/cn';
import { CardState, type RatingGrade, type VocabCard } from '@/types';
import { CharacterChips } from './CharacterChips';
import { ExampleSentence } from './ExampleSentence';
import { RatingButtons } from './RatingButtons';

export interface RecognitionCardProps {
  card: VocabCard;
  /** Deck, for the character-level "also in" layer. */
  pool: VocabCard[];
  revealed: boolean;
  previews: Record<RatingGrade, RatingPreview> | null;
  revealLatencyMs?: number | null;
  onReveal: () => void;
  onRate: (rating: RatingGrade) => void;
  /** 0 = manual tap only; >0 auto-reveals after that many ms. */
  autoRevealMs: number;
  position: number;
  total: number;
}

const COACH_KEY = 'fzt-reveals';
const COACH_REVEALS = 3;

function readRevealCount(): number {
  try {
    return Number(localStorage.getItem(COACH_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * Mode 1: Rapid Active Recognition. The prompt shows ONLY the Traditional
 * characters; pinyin and meaning are never rendered until the learner taps
 * (PRD §1.2, §5.1, AC-2).
 */
export function RecognitionCard({
  card,
  pool,
  revealed,
  previews,
  revealLatencyMs,
  onReveal,
  onRate,
  autoRevealMs,
  position,
  total,
}: RecognitionCardProps) {
  const [revealCount] = useState(readRevealCount);
  const [coachOpen, setCoachOpen] = useState(false);

  useEffect(() => {
    if (revealed || autoRevealMs <= 0) return;
    const id = window.setTimeout(onReveal, autoRevealMs);
    return () => window.clearTimeout(id);
  }, [card.id, revealed, autoRevealMs, onReveal]);

  // Count reveals so the rating rubric only coaches the first few cards ever.
  useEffect(() => {
    if (!revealed) return;
    try {
      localStorage.setItem(COACH_KEY, String(readRevealCount() + 1));
    } catch {
      /* ignore */
    }
  }, [revealed, card.id]);

  const glyphSize =
    card.traditional.length <= 2
      ? 'text-7xl'
      : card.traditional.length <= 4
        ? 'text-6xl'
        : 'text-5xl';
  const isNew = card.fsrs.state === CardState.New;
  const variants = (card.variants ?? []).filter(Boolean);

  return (
    <div
      className="flex flex-1 flex-col gap-3"
      data-testid="recognition-card"
      data-card-id={card.id}
    >
      <div className="flex items-center justify-between text-sm text-stone-500 dark:text-stone-400">
        {/* No domain chip on the prompt face: it is a retrieval cue no sign or chat carries. */}
        <span />
        <span className="flex items-center gap-2">
          {isNew && (
            <span
              className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
              data-testid="new-badge"
            >
              NEW
            </span>
          )}
          <span data-testid="session-progress">
            Card {position} of {total}
          </span>
        </span>
      </div>

      <button
        type="button"
        onClick={onReveal}
        aria-label={revealed ? 'Answer revealed' : 'Tap to reveal pinyin and meaning'}
        data-testid="recognition-prompt"
        className={cn(
          'card-surface flex items-center justify-center px-4 text-center active:bg-stone-50 dark:active:bg-ink-3',
          revealed ? 'min-h-[22dvh] py-6' : 'min-h-[38dvh] flex-1 py-8',
        )}
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
            <DomainBadge domain={card.domain} className="self-start" />
            {variants.length > 0 && (
              <p className="text-sm text-stone-600 dark:text-stone-300" data-testid="variants">
                Also written <Hanzi className="font-semibold">{variants.join('、')}</Hanzi> — common
                on signs and menus.
              </p>
            )}
            <CharacterChips card={card} pool={pool} />
            {card.exampleSentenceTraditional && (
              <div className="mt-1 border-t border-stone-200 pt-2 dark:border-stone-700">
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  例句 · Example
                </p>
                <ExampleSentence
                  sentence={card.exampleSentenceTraditional}
                  target={card.traditional}
                  pinyin={card.exampleSentencePinyin}
                  translation={card.exampleSentenceTranslation}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-stone-600 dark:text-stone-300">
            <p className="text-sm font-medium">Say it in your head — sound and meaning —</p>
            <p className="text-sm font-semibold">then tap anywhere to check</p>
            {isNew && (
              <p className="mt-1 text-xs text-stone-500">
                New word: a blank is expected, just tap.
              </p>
            )}
            {autoRevealMs > 0 && (
              <p className="mt-1 text-xs">auto-reveals in {Math.round(autoRevealMs / 1000)}s</p>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <RatingButtons
          previews={previews}
          onRate={onRate}
          visible={revealed}
          latencyMs={revealLatencyMs}
          showCoach={revealCount < COACH_REVEALS || coachOpen}
        />
        {revealed && revealCount >= COACH_REVEALS && (
          <button
            type="button"
            onClick={() => setCoachOpen((o) => !o)}
            aria-label="What do the rating buttons mean?"
            aria-expanded={coachOpen}
            className="absolute -top-1 right-0 flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 text-xs font-bold text-stone-500 dark:border-stone-600"
            data-testid="rating-help"
          >
            ?
          </button>
        )}
      </div>
    </div>
  );
}
