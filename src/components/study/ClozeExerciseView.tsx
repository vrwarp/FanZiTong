import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import type { ClozeExercise } from '@/lib/exercises/cloze';
import { CLOZE_BLANK } from '@/lib/exercises/cloze';
import type { DrillOutcome } from '@/lib/session/engine';
import { cn } from '@/lib/util/cn';
import type { VocabCard } from '@/types';

export interface ClozeExerciseViewProps {
  exercise: ClozeExercise;
  card: VocabCard;
  onComplete: (outcomes: DrillOutcome[]) => void;
}

/** Mode 2: contextual cloze deletion (PRD §5.2). Pinyin appears only in feedback. */
export function ClozeExerciseView({ exercise, card, onComplete }: ClozeExerciseViewProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const correct = picked === exercise.answer;

  return (
    <div className="flex flex-1 flex-col gap-4" data-testid="cloze-exercise">
      <div>
        <p className="text-xs font-bold tracking-wide text-brand-600 uppercase dark:text-brand-300">
          Fill in the blank · <span lang="zh-Hant-TW">填空</span>
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Which word completes the sentence?
        </p>
      </div>

      <div className="card-surface px-4 py-6">
        <Hanzi className="block text-2xl leading-relaxed" data-testid="cloze-sentence">
          {exercise.before}
          <span
            className={cn(
              'mx-0.5 rounded-md border-b-4 px-1',
              picked === null
                ? 'border-brand-400 text-brand-600'
                : correct
                  ? 'border-jade-500 text-jade-600'
                  : 'border-red-500 text-red-600',
            )}
            data-testid="cloze-blank"
          >
            {picked ?? CLOZE_BLANK}
          </span>
          {exercise.after}
        </Hanzi>
      </div>

      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Answer options">
        {exercise.options.map((option, i) => {
          const isAnswer = option === exercise.answer;
          const isPicked = option === picked;
          return (
            <button
              key={option}
              type="button"
              disabled={picked !== null}
              onClick={() => setPicked(option)}
              data-testid="cloze-option"
              data-correct={isAnswer ? 'true' : 'false'}
              className={cn(
                'card-surface flex min-h-16 items-center justify-center gap-2 px-3 text-xl font-semibold transition-colors',
                picked === null && 'active:bg-stone-100 dark:active:bg-ink-3',
                picked !== null && isAnswer && 'border-jade-500 bg-jade-500/15',
                picked !== null && isPicked && !isAnswer && 'border-red-500 bg-red-500/15',
                picked !== null && !isPicked && !isAnswer && 'opacity-50',
              )}
            >
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {String.fromCharCode(65 + i)}.
              </span>
              <Hanzi>{option}</Hanzi>
            </button>
          );
        })}
      </div>

      <div
        className="card-surface min-h-28 px-4 py-3"
        aria-live="polite"
        data-testid="cloze-feedback"
      >
        {picked === null ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Pick the character that fits.
          </p>
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            <p className={cn('font-bold', correct ? 'text-jade-600' : 'text-red-600')}>
              {correct ? '正確！ Correct' : `不對 — the answer is ${exercise.answer}`}
            </p>
            <p className="text-lg font-semibold text-brand-700 dark:text-brand-300">
              {card.pinyin} · {card.definition}
            </p>
            {exercise.sentencePinyin && (
              <p className="text-stone-600 dark:text-stone-300">{exercise.sentencePinyin}</p>
            )}
            {exercise.translation && (
              <p className="text-stone-500 dark:text-stone-400">{exercise.translation}</p>
            )}
          </div>
        )}
      </div>

      <Button
        block
        size="lg"
        disabled={picked === null}
        onClick={() => onComplete([{ cardId: exercise.cardId, correct }])}
        data-testid="drill-continue"
      >
        Continue
      </Button>
    </div>
  );
}
