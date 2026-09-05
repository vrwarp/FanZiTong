import { useMemo, useState } from 'react';
import { Hanzi } from '@/components/ui/Hanzi';
import { cn } from '@/lib/util/cn';
import { alignSentenceReadings } from '@/lib/util/sentenceReadings';

export interface ExampleSentenceProps {
  sentence: string;
  /** The word to highlight inside the sentence. */
  target: string;
  pinyin?: string;
  translation?: string;
  /** A character to underline wherever it occurs (linked from the character chips). */
  emphasizeChar?: string | null;
  className?: string;
}

/**
 * Connected-text exposure with the target word highlighted. The reading is
 * a crutch for a pinyin-literate reader, so it is never shown up front:
 * tap a word to see just that word's reading (the words you tap are the
 * ones you cannot yet read in context), or reveal everything as a second step.
 */
export function ExampleSentence({
  sentence,
  target,
  pinyin,
  translation,
  emphasizeChar,
  className,
}: ExampleSentenceProps) {
  const [openWords, setOpenWords] = useState<Set<number>>(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const words = useMemo(
    () => (pinyin ? alignSentenceReadings(sentence, pinyin) : null),
    [sentence, pinyin],
  );
  const targetIndex = target ? sentence.indexOf(target) : -1;
  const targetEnd = targetIndex + Array.from(target).length;

  const renderChars = (text: string, offset: number) =>
    Array.from(text).map((ch, i) => {
      const pos = offset + i;
      const inTarget = targetIndex >= 0 && pos >= targetIndex && pos < targetEnd;
      const emphasized = emphasizeChar && ch === emphasizeChar;
      return (
        <span
          key={pos}
          className={cn(
            inTarget &&
              'bg-brand-100 font-semibold text-brand-800 dark:bg-brand-900/50 dark:text-brand-200',
            emphasized && 'underline decoration-jade-500 decoration-4 underline-offset-4',
          )}
        >
          {ch}
        </span>
      );
    });

  return (
    <div className={cn('flex flex-col gap-1', className)} data-testid="example-sentence-block">
      <Hanzi className="block text-lg leading-loose" data-testid="example-sentence">
        {words
          ? (() => {
              const nodes: React.ReactNode[] = [];
              let cursor = 0;
              const chars = Array.from(sentence);
              words.forEach((w, wi) => {
                if (w.start > cursor)
                  nodes.push(
                    <span key={`p-${wi}`}>
                      {renderChars(chars.slice(cursor, w.start).join(''), cursor)}
                    </span>,
                  );
                const open = showAll || openWords.has(wi);
                nodes.push(
                  <button
                    key={`w-${wi}`}
                    type="button"
                    lang="zh-Hant-TW"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenWords((prev) => {
                        const next = new Set(prev);
                        if (next.has(wi)) next.delete(wi);
                        else next.add(wi);
                        return next;
                      });
                    }}
                    aria-label={open ? `${w.text} ${w.reading}` : `${w.text}, tap for reading`}
                    className="inline-flex flex-col items-center align-bottom leading-tight"
                    data-testid="sentence-word"
                  >
                    {/* The reading enters the DOM only once tapped: no crutch, not even a hidden one. */}
                    <span
                      className="min-h-3.5 font-sans text-[10px] text-stone-500 dark:text-stone-400"
                      data-testid={open ? 'word-reading' : undefined}
                    >
                      {open ? w.reading : ''}
                    </span>
                    <span>{renderChars(w.text, w.start)}</span>
                  </button>,
                );
                cursor = w.start + Array.from(w.text).length;
              });
              if (cursor < chars.length)
                nodes.push(
                  <span key="tail">{renderChars(chars.slice(cursor).join(''), cursor)}</span>,
                );
              return nodes;
            })()
          : renderChars(sentence, 0)}
      </Hanzi>
      {translation && <p className="text-sm text-stone-500 dark:text-stone-400">{translation}</p>}
      {pinyin &&
        (showAll ? (
          <p className="text-sm text-stone-600 dark:text-stone-300" data-testid="sentence-pinyin">
            {pinyin}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            {words && <span>Tap a word for its reading ·</span>}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(true);
              }}
              className="min-h-9 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-600 dark:border-stone-600 dark:text-stone-300"
              data-testid="show-sentence-pinyin"
            >
              {words ? 'Show all readings 拼音' : 'Show reading 拼音'}
            </button>
          </div>
        ))}
    </div>
  );
}
