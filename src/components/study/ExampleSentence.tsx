import { useState } from 'react';
import { Hanzi } from '@/components/ui/Hanzi';
import { cn } from '@/lib/util/cn';

export interface ExampleSentenceProps {
  sentence: string;
  /** The word to highlight inside the sentence. */
  target: string;
  pinyin?: string;
  translation?: string;
  className?: string;
}

/**
 * Connected-text exposure with the target word highlighted. The sentence's
 * pinyin is a crutch for a pinyin-literate reader, so it stays behind a tap
 * while the translation (a comprehension check) is visible.
 */
export function ExampleSentence({
  sentence,
  target,
  pinyin,
  translation,
  className,
}: ExampleSentenceProps) {
  const [showReading, setShowReading] = useState(false);
  const index = target ? sentence.indexOf(target) : -1;
  return (
    <div className={cn('flex flex-col gap-1', className)} data-testid="example-sentence-block">
      <Hanzi className="block text-lg leading-relaxed" data-testid="example-sentence">
        {index >= 0 ? (
          <>
            {sentence.slice(0, index)}
            <mark className="rounded-sm bg-brand-100 px-0.5 font-semibold text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
              {target}
            </mark>
            {sentence.slice(index + target.length)}
          </>
        ) : (
          sentence
        )}
      </Hanzi>
      {translation && <p className="text-sm text-stone-500 dark:text-stone-400">{translation}</p>}
      {pinyin &&
        (showReading ? (
          <p className="text-sm text-stone-600 dark:text-stone-300" data-testid="sentence-pinyin">
            {pinyin}
          </p>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowReading(true);
            }}
            className="min-h-9 self-start rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-600 dark:border-stone-600 dark:text-stone-300"
            data-testid="show-sentence-pinyin"
          >
            Show reading 拼音
          </button>
        ))}
    </div>
  );
}
