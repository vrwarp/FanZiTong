import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { charInfo } from '@/data/charInfo';
import type { ClozeExercise } from '@/lib/exercises/cloze';
import { clozeBlank } from '@/lib/exercises/cloze';
import { diffCharacters } from '@/lib/exercises/foil';
import type { DrillOutcome as DrillOutcomeType } from '@/lib/session/engine';
import { cn } from '@/lib/util/cn';
import type { VocabCard } from '@/types';
import { DrillOutcome } from './DrillOutcome';
import { ExampleSentence } from './ExampleSentence';

export interface ClozeExerciseViewProps {
  exercise: ClozeExercise;
  card: VocabCard;
  onComplete: (outcomes: DrillOutcomeType[]) => void;
}

const CORRECT_PHRASES = ['答對了！', '讚啦！', '太強了！'];

/** Mode 2: contextual cloze deletion (PRD §5.2). Pinyin appears only in feedback. */
export function ClozeExerciseView({ exercise, card, onComplete }: ClozeExerciseViewProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const correct = picked === exercise.answer;
  const diffs = picked && !correct ? diffCharacters(picked, exercise.answer) : [];
  const phrase = CORRECT_PHRASES[exercise.answer.length % CORRECT_PHRASES.length];

  return (
    <div className="flex flex-1 flex-col gap-4" data-testid="cloze-exercise">
      <div>
        <p className="text-xs font-bold tracking-wide text-brand-600 uppercase dark:text-brand-300">
          Fill the Blank · <span lang="zh-Hant-TW">填空</span>
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Read the sentence and pick the word that fits.
        </p>
      </div>

      <div className="card-surface px-4 py-6">
        <Hanzi className="block text-2xl leading-relaxed" data-testid="cloze-sentence">
          {exercise.before}
          <span
            className={cn(
              'rounded-md border-b-4',
              picked === null
                ? 'border-brand-400 text-brand-600'
                : correct
                  ? 'border-jade-500 text-jade-600'
                  : 'border-red-500 text-red-600',
            )}
            data-testid="cloze-blank"
          >
            {picked ?? clozeBlank(exercise.answer)}
          </span>
          {exercise.after}
        </Hanzi>
      </div>

      <div
        className="card-surface min-h-24 px-4 py-3"
        aria-live="polite"
        data-testid="cloze-feedback"
      >
        {picked === null ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Only one option fits the grammar and the meaning.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5 text-sm">
            <p className={cn('font-bold', correct ? 'text-jade-600' : 'text-red-600')}>
              {correct ? (
                <>
                  <Hanzi>{phrase}</Hanzi> Correct
                </>
              ) : (
                <>
                  <Hanzi>不對</Hanzi> — the answer is <Hanzi>{exercise.answer}</Hanzi>
                  {diffs.length > 0 && (
                    <span className="font-normal text-stone-600 dark:text-stone-300">
                      {' '}
                      (you picked{' '}
                      <Hanzi>
                        {Array.from(picked).map((ch, i) => (
                          <span
                            key={i}
                            className={cn(
                              diffs.some((d) => d.index === i) &&
                                'rounded bg-red-100 px-0.5 dark:bg-red-900/40',
                            )}
                          >
                            {ch}
                          </span>
                        ))}
                      </Hanzi>
                      )
                    </span>
                  )}
                </>
              )}
            </p>
            <p className="text-lg font-semibold text-brand-700 dark:text-brand-300">
              {card.pinyin} · {card.definition}
            </p>
            {diffs.length > 0 && (
              <p className="text-xs text-stone-600 dark:text-stone-300" data-testid="cloze-diff">
                {diffs.map((d) => {
                  const info = charInfo(d.correct);
                  return (
                    <span key={d.index} className="mr-2">
                      <Hanzi className="font-semibold text-red-700">{d.picked}</Hanzi> →{' '}
                      <Hanzi className="font-semibold text-jade-600">{d.correct}</Hanzi>
                      {info?.tell && ` · ${info.tell}`}
                    </span>
                  );
                })}
              </p>
            )}
            <ExampleSentence
              sentence={exercise.before + exercise.answer + exercise.after}
              target={exercise.answer}
              pinyin={exercise.sentencePinyin}
              translation={exercise.translation}
            />
            <ul
              className="mt-1 grid grid-cols-1 gap-0.5 text-xs text-stone-500 dark:text-stone-400"
              data-testid="cloze-glosses"
            >
              {exercise.options
                .filter((o) => o !== exercise.answer && exercise.optionInfo[o])
                .map((o) => (
                  <li key={o}>
                    <Hanzi className="font-semibold">{o}</Hanzi> {exercise.optionInfo[o].pinyin} ·{' '}
                    {exercise.optionInfo[o].definition}
                  </li>
                ))}
            </ul>
            <DrillOutcome card={card} correct={correct} />
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Answer options">
          {exercise.options.map((option) => {
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
                <Hanzi>{option}</Hanzi>
              </button>
            );
          })}
        </div>
        {picked !== null && (
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
