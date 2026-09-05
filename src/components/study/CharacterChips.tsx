import { useState } from 'react';
import { Hanzi } from '@/components/ui/Hanzi';
import { cn } from '@/lib/util/cn';
import { hanChars, syllablesPerCharacter } from '@/lib/util/pinyin';
import type { VocabCard } from '@/types';

export interface CharacterChipsProps {
  card: VocabCard;
  /** Deck used to find other words sharing each character. */
  pool: VocabCard[];
}

/**
 * The character-level layer: each character of the word as a chip with its
 * own reading (when derivable from the pinyin) and, on tap, other deck words
 * it appears in — so 滷 is bound to lǔ, not just to the silhouette of 滷肉飯.
 */
export function CharacterChips({ card, pool }: CharacterChipsProps) {
  const [open, setOpen] = useState<number | null>(null);
  const chars = hanChars(card.traditional);
  if (chars.length < 2) return null;
  const syllables = syllablesPerCharacter(card.traditional, card.pinyin);
  const alsoIn = (ch: string) =>
    pool
      .filter((c) => c.id !== card.id && c.traditional.includes(ch))
      .map((c) => c.traditional)
      .slice(0, 4);

  return (
    <div className="flex flex-col gap-1" data-testid="character-chips">
      <div className="flex flex-wrap gap-1.5">
        {chars.map((ch, i) => {
          const related = alsoIn(ch);
          const active = open === i;
          return (
            <button
              key={`${ch}-${i}`}
              type="button"
              disabled={related.length === 0}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(active ? null : i);
              }}
              aria-expanded={active}
              className={cn(
                'flex min-h-9 items-center gap-1 rounded-lg border px-2 text-sm',
                active
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                  : 'border-stone-200 dark:border-stone-700',
                related.length === 0 && 'opacity-70',
              )}
              data-testid="character-chip"
            >
              <Hanzi className="text-base font-semibold">{ch}</Hanzi>
              {syllables && (
                <span className="text-xs text-stone-500 dark:text-stone-400">{syllables[i]}</span>
              )}
              {related.length > 0 && (
                <span className="text-[11px] text-stone-600 dark:text-stone-300">
                  +{related.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {open !== null && (
        <p className="text-xs text-stone-600 dark:text-stone-300" data-testid="character-also-in">
          <Hanzi className="font-semibold">{chars[open]}</Hanzi> also in:{' '}
          <Hanzi>{alsoIn(chars[open]).join('、')}</Hanzi>
        </p>
      )}
    </div>
  );
}
