import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { inputClass } from '@/components/ui/Field';
import { Hanzi } from '@/components/ui/Hanzi';
import {
  markReading,
  readingMatches,
  type MarkedReading,
  type SyllableMark,
  type TypedReadingExercise,
} from '@/lib/exercises/reading';
import type { DrillOutcome as DrillOutcomeType } from '@/lib/session/engine';
import { cn } from '@/lib/util/cn';
import type { VocabCard } from '@/types';
import { DrillOutcome } from './DrillOutcome';
import { ExampleSentence } from './ExampleSentence';

export interface TypedReadingViewProps {
  exercise: TypedReadingExercise;
  card?: VocabCard;
  onComplete: (outcomes: DrillOutcomeType[]) => void;
}

/** Wrong tries before the reading is shown. */
export const MAX_TYPED_TRIES = 2;

type Phase = 'type' | 'wrong' | 'done';

/**
 * Mode 6: Say It. The characters alone; the reading is typed, tones
 * optional. A first-try hit is a reading and is graded as one. A wrong try
 * is marked syllable by syllable — which one is off, never what it should
 * be — and gets one more go; right on the second try is recorded and
 * changes nothing; a second wrong try, or "I can't read it", shows the
 * reading and is a miss.
 */
export function TypedReadingView({ exercise, card, onComplete }: TypedReadingViewProps) {
  const [phase, setPhase] = useState<Phase>('type');
  const [typed, setTyped] = useState('');
  const [tries, setTries] = useState<string[]>([]);
  const [marks, setMarks] = useState<SyllableMark[] | null>(null);
  const [against, setAgainst] = useState<MarkedReading>('pinyin');
  const [gaveUp, setGaveUp] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (phase !== 'done') inputRef.current?.focus();
  }, [phase]);

  const done = phase === 'done';
  const misses = tries.length;
  const correct = done && !gaveUp && misses < MAX_TYPED_TRIES;
  const firstTry = correct && misses === 0;
  // A miss on the second try, or giving up, is graded; found on the second
  // try is recorded and leaves the schedule alone.
  const applyRating = firstTry || !correct;

  const check = () => {
    if (done) return;
    const value = typed.trim();
    if (!value) return;
    if (readingMatches(value, exercise.accepted, exercise.acceptedSpoken)) {
      setMarks(null);
      setPhase('done');
      return;
    }
    const next = [...tries, value];
    setTries(next);
    const marked = markReading(value, exercise);
    setMarks(marked.marks);
    setAgainst(marked.against);
    if (next.length >= MAX_TYPED_TRIES) {
      setPhase('done');
    } else {
      setPhase('wrong');
      setTyped('');
    }
  };

  const giveUp = () => {
    if (done) return;
    setGaveUp(true);
    setMarks(null);
    setPhase('done');
  };

  return (
    <div className="flex flex-1 flex-col gap-4" data-testid="typed-exercise">
      <div>
        <p className="text-xs font-bold tracking-wide text-brand-600 uppercase dark:text-brand-300">
          Say It · <span lang="zh-Hant-TW">唸出來</span>
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {exercise.spoken ? (
            <>
              Read it, then type the reading — pinyin, or the Taiwanese (Tâi-lô or POJ); tones
              optional. <span lang="zh-Hant-TW">唸出來，再打拼音或台羅</span>
            </>
          ) : (
            <>
              Read it, then type the pinyin — tones optional.{' '}
              <span lang="zh-Hant-TW">唸出來，再打拼音</span>
            </>
          )}
        </p>
      </div>

      <div className="card-surface flex flex-col items-center justify-center px-4 py-6 text-center">
        <Hanzi
          className={cn(
            exercise.word.length <= 2 ? 'text-6xl' : 'text-5xl',
            'font-bold leading-tight tracking-wide',
          )}
          data-testid="typed-prompt"
        >
          {exercise.word}
        </Hanzi>
      </div>

      {!done && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <input
            ref={inputRef}
            className={cn(inputClass, 'text-lg')}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`${exercise.syllables.length} syllable${exercise.syllables.length === 1 ? '' : 's'}, one per space${exercise.spoken ? ' · pinyin or Taiwanese' : ''}`}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            lang="zh-Latn-pinyin"
            aria-label="The reading, in pinyin"
            data-testid="typed-input"
          />
          <div className="flex gap-2">
            <Button type="submit" block disabled={!typed.trim()} data-testid="typed-check">
              Check 對答案
            </Button>
            <Button type="button" variant="outline" onClick={giveUp} data-testid="typed-giveup">
              Can’t read it 不會唸
            </Button>
          </div>
        </form>
      )}

      <div className="card-surface px-4 py-3" aria-live="polite" data-testid="typed-feedback">
        {phase === 'type' && (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Say it in your head first; the syllables you type are the reading you would give it.
          </p>
        )}
        {phase === 'wrong' && marks && (
          <div className="flex flex-col gap-2">
            <p className="font-bold text-red-600" data-testid="typed-wrong" data-against={against}>
              <Hanzi>不對</Hanzi> — {describeMarks(marks)}
              {against === 'spoken' && ' (against the Taiwanese)'}. Once more.{' '}
              <span lang="zh-Hant-TW">再試一次</span>
            </p>
            <Syllables marks={marks} />
          </div>
        )}
        {done && (
          <div className="flex flex-col gap-2">
            <p className={cn('font-bold', correct ? 'text-jade-600' : 'text-red-600')}>
              {correct ? (
                <>
                  <Hanzi>{firstTry ? '答對了！' : '找到了！'}</Hanzi>{' '}
                  {firstTry ? 'Read it' : 'Found it'} —{' '}
                </>
              ) : (
                <>
                  <Hanzi>{gaveUp ? '沒關係' : '不對'}</Hanzi> —{' '}
                  {gaveUp ? 'not yet' : 'not this time'}; it reads{' '}
                </>
              )}
              <span className="text-brand-700 dark:text-brand-300" data-testid="typed-reading">
                {exercise.reading}
              </span>
              {exercise.reading !== exercise.pinyin && (
                <span className="text-sm font-normal text-stone-500"> · {exercise.pinyin}</span>
              )}
            </p>
            {marks && !correct && <Syllables marks={marks} />}
            <p className="text-lg" data-testid="typed-definition">
              {exercise.definition}
            </p>
            <DrillOutcome card={card} correct={correct} applyRating={applyRating} reading />
            {exercise.sentence && (
              <ExampleSentence
                sentence={exercise.sentence.traditional}
                target={exercise.word}
                pinyin={exercise.sentence.pinyin}
                translation={exercise.sentence.translation}
                className="mt-1"
              />
            )}
          </div>
        )}
      </div>

      {done && (
        <Button
          block
          size="lg"
          onClick={() =>
            onComplete([
              {
                cardId: exercise.cardId,
                correct,
                applyRating,
                misses: gaveUp ? Math.max(1, misses) : misses,
                ...(tries[0] ? { picked: tries[0] } : {}),
              },
            ])
          }
          data-testid="drill-continue"
        >
          Continue
        </Button>
      )}
    </div>
  );
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/** "the 2nd syllable is off", "the 1st and 3rd syllables are off". */
function describeMarks(marks: SyllableMark[]): string {
  const off = marks.map((m, i) => (m.ok ? null : (ORDINALS[i] ?? `${i + 1}th`))).filter(Boolean);
  if (off.length === 0) return 'the syllables are right but something else is not';
  if (off.length === marks.length) return 'not that reading';
  if (off.length === 1) return `the ${off[0]} syllable is off`;
  return `the ${off.slice(0, -1).join(', ')} and ${off.at(-1)} syllables are off`;
}

/** One box per syllable, right or wrong; the reading itself stays hidden until the end. */
function Syllables({ marks }: { marks: SyllableMark[] }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="typed-syllables">
      {marks.map((m, i) => (
        <span
          key={i}
          data-testid="typed-syllable"
          data-ok={m.ok ? 'true' : 'false'}
          className={cn(
            'flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-bold',
            m.ok
              ? 'border-jade-500 bg-jade-500/15 text-jade-600'
              : 'border-red-500 bg-red-500/15 text-red-700 dark:text-red-200',
          )}
          aria-label={`Syllable ${i + 1}: ${m.ok ? 'right' : 'off'}`}
        >
          {m.ok ? '✓' : '✗'}
        </span>
      ))}
    </div>
  );
}
