import { Hanzi } from '@/components/ui/Hanzi';
import { charInfo } from '@/data/charInfo';
import { cn } from '@/lib/util/cn';
import { hanChars, syllablesPerCharacter } from '@/lib/util/pinyin';
import type { VocabCard } from '@/types';

export interface CharacterChipsProps {
  card: VocabCard;
  /** Deck used to find other words sharing each character. */
  pool: VocabCard[];
  selected: string | null;
  onSelect: (char: string | null) => void;
}

/**
 * The character-level layer: each character of the word as a chip with its
 * own reading (when derivable from the pinyin), a gloss when known, and on
 * tap the other deck words it appears in — so 滷 is bound to lǔ, not just to
 * the silhouette of 滷肉飯. The selected character is also underlined in the
 * example sentence.
 */
export function CharacterChips({ card, pool, selected, onSelect }: CharacterChipsProps) {
  const chars = hanChars(card.traditional);
  if (chars.length < 2) return null;
  const syllables = syllablesPerCharacter(card.traditional, card.pinyin);
  const alsoIn = (ch: string) =>
    pool
      .filter((c) => c.id !== card.id && c.traditional.includes(ch))
      .map((c) => c.traditional)
      .slice(0, 4);
  const selectedIndex = selected ? chars.indexOf(selected) : -1;

  return (
    <div className="flex flex-col gap-1" data-testid="character-chips">
      <p className="text-[11px] text-stone-500 dark:text-stone-400">
        Tap a character for its meaning and other words with it
      </p>
      <div className="flex flex-wrap gap-1.5">
        {chars.map((ch, i) => {
          const related = alsoIn(ch);
          const active = selected === ch;
          return (
            <button
              key={`${ch}-${i}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(active ? null : ch);
              }}
              aria-expanded={active}
              className={cn(
                'flex min-h-9 items-center gap-1 rounded-lg border px-2 text-sm',
                active
                  ? 'border-jade-500 bg-jade-500/10'
                  : 'border-stone-200 dark:border-stone-700',
              )}
              data-testid="character-chip"
            >
              <Hanzi className="text-base font-semibold">{ch}</Hanzi>
              {syllables && (
                <span className="text-xs text-stone-500 dark:text-stone-400">{syllables[i]}</span>
              )}
              {related.length > 0 && (
                <span className="text-[11px] text-stone-600 dark:text-stone-300">
                  · {related.length} more word{related.length === 1 ? '' : 's'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selectedIndex >= 0 && (
        <p className="text-xs text-stone-600 dark:text-stone-300" data-testid="character-also-in">
          <Hanzi className="font-semibold">{chars[selectedIndex]}</Hanzi>
          {charInfo(chars[selectedIndex]) &&
            ` ${charInfo(chars[selectedIndex])!.pinyin} “${charInfo(chars[selectedIndex])!.gloss}”`}
          {alsoIn(chars[selectedIndex]).length > 0 ? (
            <>
              {' '}
              · also in <Hanzi>{alsoIn(chars[selectedIndex]).join('、')}</Hanzi>
            </>
          ) : (
            ' · no other deck word yet'
          )}
        </p>
      )}
    </div>
  );
}
