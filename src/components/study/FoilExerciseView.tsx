import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import type { FoilExercise } from '@/lib/exercises/foil';
import type { DrillOutcome } from '@/lib/session/engine';
import { cn } from '@/lib/util/cn';

export interface FoilExerciseViewProps {
  exercise: FoilExercise;
  onComplete: (outcomes: DrillOutcome[]) => void;
}

/**
 * Mode 4: visual foil discrimination (PRD §5.4). The cue is sound + meaning;
 * the learner must pick the correct shape among look-alikes.
 */
export function FoilExerciseView({ exercise, onComplete }: FoilExerciseViewProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const correct = picked === exercise.answer;
  const big = exercise.answer.length <= 2 ? 'text-5xl' : 'text-3xl';

  return (
    <div className="flex flex-1 flex-col gap-4" data-testid="foil-exercise">
      <div>
        <p className="text-xs font-bold tracking-wide text-brand-600 uppercase dark:text-brand-300">
          Spot the right character · <span lang="zh-Hant-TW">辨字</span>
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Select the correct characters for:
        </p>
      </div>

      <div className="card-surface px-4 py-5 text-center">
        <p className="text-2xl font-bold text-brand-700 dark:text-brand-300" data-testid="foil-cue">
          ‘{exercise.pinyin}’
        </p>
        <p className="mt-1 text-base text-stone-600 dark:text-stone-300">{exercise.definition}</p>
      </div>

      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Character options">
        {exercise.options.map((option) => {
          const isAnswer = option === exercise.answer;
          const isPicked = option === picked;
          return (
            <button
              key={option}
              type="button"
              disabled={picked !== null}
              onClick={() => setPicked(option)}
              data-testid="foil-option"
              data-correct={isAnswer ? 'true' : 'false'}
              className={cn(
                'card-surface flex min-h-24 items-center justify-center px-2 transition-colors',
                picked === null && 'active:bg-stone-100 dark:active:bg-ink-3',
                picked !== null && isAnswer && 'border-jade-500 bg-jade-500/15',
                picked !== null && isPicked && !isAnswer && 'border-red-500 bg-red-500/15',
                picked !== null && !isPicked && !isAnswer && 'opacity-50',
              )}
            >
              <Hanzi className={cn(big, 'font-bold')}>{option}</Hanzi>
            </button>
          );
        })}
      </div>

      <div
        className="card-surface min-h-16 px-4 py-3"
        aria-live="polite"
        data-testid="foil-feedback"
      >
        {picked === null ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Look at the radicals — which one carries the meaning?
          </p>
        ) : (
          <p className={cn('font-bold', correct ? 'text-jade-600' : 'text-red-600')}>
            {correct ? '正確！ Correct' : `不對 — the correct form is ${exercise.answer}`}
          </p>
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
