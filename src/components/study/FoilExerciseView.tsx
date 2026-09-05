import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { charInfo } from '@/data/charInfo';
import type { FoilExercise } from '@/lib/exercises/foil';
import { diffCharacters } from '@/lib/exercises/foil';
import type { DrillOutcome as DrillOutcomeType } from '@/lib/session/engine';
import { cn } from '@/lib/util/cn';
import type { VocabCard } from '@/types';
import { DrillOutcome } from './DrillOutcome';

export interface FoilExerciseViewProps {
  exercise: FoilExercise;
  card?: VocabCard;
  onComplete: (outcomes: DrillOutcomeType[]) => void;
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

function Highlighted({
  word,
  indices,
  tone,
}: {
  word: string;
  indices: number[];
  tone: 'red' | 'jade';
}) {
  return (
    <Hanzi className="text-4xl font-bold">
      {Array.from(word).map((ch, i) => (
        <span
          key={i}
          className={cn(
            indices.includes(i) &&
              (tone === 'red'
                ? 'rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
                : 'rounded bg-jade-500/15 text-jade-600'),
          )}
        >
          {ch}
        </span>
      ))}
    </Hanzi>
  );
}

/**
 * Mode 4: visual foil discrimination (PRD §5.4). The cue is sound + meaning;
 * the learner must pick the correct shape among look-alikes. A wrong pick
 * shows exactly which character differs and asks for one corrective tap.
 */
export function FoilExerciseView({ exercise, card, onComplete }: FoilExerciseViewProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const correct = picked === exercise.answer;
  const diffs = picked && !correct ? diffCharacters(picked, exercise.answer) : [];
  const diffIndices = diffs.map((d) => d.index);
  const big = exercise.answer.length <= 2 ? 'text-5xl' : 'text-3xl';
  const canContinue = picked !== null && (correct || confirmed);

  return (
    <div className="flex flex-1 flex-col gap-4" data-testid="foil-exercise">
      <div>
        <p className="text-xs font-bold tracking-wide text-brand-600 uppercase dark:text-brand-300">
          Spot the Character · <span lang="zh-Hant-TW">辨字</span>
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Which one is written correctly?
        </p>
      </div>

      <div className="card-surface px-4 py-5 text-center">
        <p className="text-2xl font-bold text-brand-700 dark:text-brand-300" data-testid="foil-cue">
          ‘{exercise.pinyin}’
        </p>
        <p className="mt-1 text-base text-stone-600 dark:text-stone-300">{exercise.definition}</p>
      </div>

      <div
        className="card-surface min-h-16 px-4 py-3"
        aria-live="polite"
        data-testid="foil-feedback"
      >
        {picked === null ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Look at each character, not the silhouette.
          </p>
        ) : correct ? (
          <div className="flex flex-col gap-1">
            <p className="font-bold text-jade-600">
              <Hanzi>答對了！</Hanzi> Correct
            </p>
            <DrillOutcome card={card} correct />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="font-bold text-red-600">
              <Hanzi>不對</Hanzi> — look at the{' '}
              {diffs.length === 1 ? ORDINALS[diffs[0].index] : 'highlighted'} character
            </p>
            <div className="flex items-center justify-around gap-2">
              <div className="text-center">
                <p className="text-xs text-stone-500">you picked</p>
                <Highlighted word={picked} indices={diffIndices} tone="red" />
              </div>
              <span className="text-stone-600 dark:text-stone-300">→</span>
              <div className="text-center">
                <p className="text-xs text-stone-500">the word is</p>
                <Highlighted word={exercise.answer} indices={diffIndices} tone="jade" />
              </div>
            </div>
            {diffs.length > 0 && (
              <div className="text-sm text-stone-600 dark:text-stone-300" data-testid="foil-diff">
                {diffs.map((d) => {
                  const picked = charInfo(d.picked);
                  const right = charInfo(d.correct);
                  return (
                    <p key={d.index}>
                      <Hanzi className="font-semibold text-red-700">{d.picked}</Hanzi>
                      {picked && ` ${picked.pinyin} “${picked.gloss}”`} is not{' '}
                      <Hanzi className="font-semibold text-jade-600">{d.correct}</Hanzi>
                      {right && ` ${right.pinyin} “${right.gloss}”`}
                      {right?.tell && (
                        <span className="block text-xs text-stone-500">{right.tell}</span>
                      )}
                    </p>
                  );
                })}
              </div>
            )}
            {!confirmed && (
              <p
                className="text-sm font-semibold text-stone-700 dark:text-stone-200"
                data-testid="foil-confirm-hint"
              >
                Now tap <Hanzi>{exercise.answer}</Hanzi> to continue.
              </p>
            )}
            {confirmed && <DrillOutcome card={card} correct={false} />}
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Character options">
          {exercise.options.map((option) => {
            const isAnswer = option === exercise.answer;
            const isPicked = option === picked;
            // After a wrong pick only the correct tile stays live, for one corrective retrieval.
            const disabled = picked !== null && (correct || confirmed || !isAnswer);
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (picked === null) setPicked(option);
                  else if (isAnswer) setConfirmed(true);
                }}
                data-testid="foil-option"
                data-correct={isAnswer ? 'true' : 'false'}
                className={cn(
                  'card-surface flex min-h-24 items-center justify-center px-2 transition-colors',
                  picked === null && 'active:bg-stone-100 dark:active:bg-ink-3',
                  picked !== null && isAnswer && 'border-jade-500 bg-jade-500/15',
                  picked !== null &&
                    isAnswer &&
                    !correct &&
                    !confirmed &&
                    'animate-pulse ring-2 ring-jade-500',
                  picked !== null && isPicked && !isAnswer && 'border-red-500 bg-red-500/15',
                  picked !== null && !isPicked && !isAnswer && 'opacity-50',
                )}
              >
                <Hanzi className={cn(big, 'font-bold')}>{option}</Hanzi>
              </button>
            );
          })}
        </div>
        {canContinue && (
          <Button
            block
            size="lg"
            onClick={() => onComplete([{ cardId: exercise.cardId, correct }])}
            data-testid="drill-continue"
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
