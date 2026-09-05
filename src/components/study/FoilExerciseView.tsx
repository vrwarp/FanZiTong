import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { charInfo } from '@/data/charInfo';
import type { FoilExercise } from '@/lib/exercises/foil';
import { diffCharacters } from '@/lib/exercises/foil';
import type { DrillOutcome as DrillOutcomeType } from '@/lib/session/engine';
import { cn } from '@/lib/util/cn';
import { mulberry32, shuffle } from '@/lib/util/random';
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

type Phase = 'pick' | 'wrong' | 'retry' | 'gate' | 'done';

/** After this many misses the answer is shown and tapped once, so the screen cannot loop. */
export const MAX_FOIL_MISSES = 3;

/**
 * Mode 4: visual foil discrimination (PRD §5.4). The cue is sound + meaning;
 * the learner must pick the correct shape among look-alikes. A wrong pick
 * shows exactly which character differs, then asks for a fresh retrieval on
 * reshuffled, unmarked tiles — not a copy of the highlighted answer.
 */
export function FoilExerciseView({ exercise, card, onComplete }: FoilExerciseViewProps) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [picked, setPicked] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const [retryOrder, setRetryOrder] = useState(0);
  const options = useMemo(
    () =>
      retryOrder === 0
        ? exercise.options
        : shuffle(exercise.options, mulberry32(retryOrder * 7919)),
    [exercise.options, retryOrder],
  );
  const correct = misses === 0 && phase === 'done';
  const diffs = picked && picked !== exercise.answer ? diffCharacters(picked, exercise.answer) : [];
  const diffIndices = diffs.map((d) => d.index);
  const big = exercise.answer.length <= 2 ? 'text-5xl' : 'text-3xl';
  const cue = card?.spoken ?? exercise.pinyin;

  const choose = (option: string) => {
    if (phase === 'done' || phase === 'wrong') return;
    if (phase === 'gate') {
      if (option === exercise.answer) setPhase('done');
      return;
    }
    setPicked(option);
    if (option === exercise.answer) {
      setPhase('done');
      return;
    }
    setMisses((m) => m + 1);
    setPhase('wrong');
  };

  // A third miss stops the loop: the answer is shown and tapped once (copy-match gate).
  const gated = misses >= MAX_FOIL_MISSES;
  const startRetry = () => {
    if (gated) {
      setPicked(null);
      setPhase('gate');
      return;
    }
    setRetryOrder((n) => n + 1);
    setPicked(null);
    setPhase('retry');
  };

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

      <div className="card-surface flex flex-1 flex-col items-center justify-center px-4 py-5 text-center">
        <p className="text-3xl font-bold text-brand-700 dark:text-brand-300" data-testid="foil-cue">
          ‘{cue}’
        </p>
        <p className="mt-1 text-base text-stone-600 dark:text-stone-300">{exercise.definition}</p>
      </div>

      <div className="card-surface px-4 py-3" aria-live="polite" data-testid="foil-feedback">
        {phase === 'pick' && (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Look at each character, not the silhouette.
          </p>
        )}
        {phase === 'retry' && (
          <p
            className="text-sm font-semibold text-stone-700 dark:text-stone-200"
            data-testid="foil-retry-hint"
          >
            {misses > 1 ? 'Once more — find' : 'Now find'} ‘{cue}’ again.{' '}
            <span lang="zh-Hant-TW">再找一次</span>
          </p>
        )}
        {phase === 'gate' && (
          <p
            className="text-sm font-semibold text-stone-700 dark:text-stone-200"
            data-testid="foil-gate-hint"
          >
            The word is <Hanzi className="text-jade-600">{exercise.answer}</Hanzi> — tap it to
            continue. <span lang="zh-Hant-TW">點一下正確答案</span>
          </p>
        )}
        {phase === 'done' && (
          <div className="flex flex-col gap-1">
            <p className="font-bold text-jade-600">
              <Hanzi>{correct ? '答對了！' : '找到了！'}</Hanzi> {correct ? 'Correct' : 'Found it'}
            </p>
            <DrillOutcome card={card} correct={correct} />
          </div>
        )}
        {phase === 'wrong' && picked && (
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
                  const pickedInfo = charInfo(d.picked);
                  const right = charInfo(d.correct);
                  return (
                    <p key={d.index}>
                      <Hanzi className="font-semibold text-red-700">{d.picked}</Hanzi>
                      {pickedInfo && ` ${pickedInfo.pinyin} “${pickedInfo.gloss}”`} is not{' '}
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
            <Button size="sm" variant="outline" onClick={startRetry} data-testid="foil-retry">
              {gated ? 'Show me the word 看答案' : 'Got it — try again 再找一次'}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Character options">
          {options.map((option) => {
            const isAnswer = option === exercise.answer;
            const isPicked = option === picked;
            const marked = phase === 'done' || phase === 'wrong';
            return (
              <button
                key={option}
                type="button"
                disabled={marked || (phase === 'gate' && !isAnswer)}
                onClick={() => choose(option)}
                data-testid="foil-option"
                data-correct={isAnswer ? 'true' : 'false'}
                className={cn(
                  'card-surface flex min-h-24 items-center justify-center px-2 transition-colors',
                  !marked && 'active:bg-stone-100 dark:active:bg-ink-3',
                  (phase === 'done' || phase === 'gate') &&
                    isAnswer &&
                    'border-jade-500 bg-jade-500/15',
                  phase === 'gate' && !isAnswer && 'opacity-50',
                  phase === 'wrong' && isPicked && 'border-red-500 bg-red-500/15',
                  marked && !isPicked && !(phase === 'done' && isAnswer) && 'opacity-50',
                )}
              >
                <Hanzi className={cn(big, 'font-bold')}>{option}</Hanzi>
              </button>
            );
          })}
        </div>
        {phase === 'done' && (
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
