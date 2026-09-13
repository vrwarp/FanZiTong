import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { charInfo } from '@/data/charInfo';
import { diffCharacters } from '@/lib/exercises/foil';
import type { MeaningExercise } from '@/lib/exercises/meaning';
import type { DrillOutcome as DrillOutcomeType } from '@/lib/session/engine';
import { cn } from '@/lib/util/cn';
import { mulberry32, shuffle } from '@/lib/util/random';
import { DOMAIN_LABELS, type VocabCard } from '@/types';
import { CharacterContrast } from './CharacterContrast';
import { DrillOutcome } from './DrillOutcome';
import { ExampleSentence } from './ExampleSentence';
import { MAX_FOIL_MISSES } from './FoilExerciseView';

export interface MeaningExerciseViewProps {
  exercise: MeaningExercise;
  card?: VocabCard;
  onComplete: (outcomes: DrillOutcomeType[]) => void;
}

type Phase = 'ear' | 'pick' | 'wrong' | 'retry' | 'gate' | 'done';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

/**
 * Mode 5: from the meaning to the word. Step one, when it is due, asks which
 * reading the word has — is it known by ear? — and is never scored. Step two
 * asks which written word it is, graded like Fill the Blank: a readable word
 * that is not this one is a misreading of that word (explained, retired, no
 * schedule change); the same-sound misspelling is a miss on the target.
 */
export function MeaningExerciseView({ exercise, card, onComplete }: MeaningExerciseViewProps) {
  const [phase, setPhase] = useState<Phase>(exercise.readings.length > 0 ? 'ear' : 'pick');
  const [heard, setHeard] = useState<boolean | null>(null);
  const [pickedReading, setPickedReading] = useState<string | null>(null);
  /** Real words tried that were not this one (retired tiles). */
  const [misreads, setMisreads] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [retryOrder, setRetryOrder] = useState(0);
  const [revealedTiles, setRevealedTiles] = useState<Set<string>>(() => new Set());
  const options = useMemo(
    () =>
      retryOrder === 0
        ? exercise.options
        : shuffle(exercise.options, mulberry32(retryOrder * 7919)),
    [exercise.options, retryOrder],
  );
  const foil = exercise.foil ?? null;
  const lastMisread = misreads.at(-1) ?? null;
  const lastInfo = lastMisread ? exercise.optionInfo[lastMisread] : undefined;
  const done = phase === 'done';
  const foilPicked = misses > 0;
  const firstTry = done && misreads.length === 0 && !foilPicked;
  const applyRating = firstTry || foilPicked;
  const foilDiff = foil ? diffCharacters(foil, exercise.answer) : [];
  const foilDiffIndices = foilDiff.map((d) => d.index);
  const gated = misses >= MAX_FOIL_MISSES;
  const big = exercise.answer.length <= 2 ? 'text-5xl' : 'text-3xl';
  const wrongReading = pickedReading ? exercise.readingInfo[pickedReading] : undefined;

  const chooseReading = (reading: string) => {
    if (phase !== 'ear') return;
    setPickedReading(reading);
    setHeard(reading === exercise.reading);
    setPhase('pick');
  };

  const pick = (option: string) => {
    if (done || phase === 'wrong' || phase === 'ear' || misreads.includes(option)) return;
    if (phase === 'gate') {
      if (option === exercise.answer) setPhase('done');
      return;
    }
    if (option === exercise.answer) {
      setPhase('done');
    } else if (option === foil) {
      setMisses((m) => m + 1);
      setPhase('wrong');
    } else {
      setMisreads((prev) => [...prev, option]);
    }
  };

  const startRetry = () => {
    if (gated) {
      setPhase('gate');
      return;
    }
    setRetryOrder((n) => n + 1);
    setPhase('retry');
  };

  const reveal = (option: string) =>
    setRevealedTiles((prev) => {
      const next = new Set(prev);
      next.add(option);
      return next;
    });

  return (
    <div className="flex flex-1 flex-col gap-4" data-testid="meaning-exercise">
      <div>
        <p className="text-xs font-bold tracking-wide text-brand-600 uppercase dark:text-brand-300">
          Which Word · <span lang="zh-Hant-TW">選詞</span>
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {phase === 'ear' ? (
            <>
              First, by ear: which one is it? <span lang="zh-Hant-TW">先用耳朵：是哪一個？</span>
            </>
          ) : (
            <>
              Which word means this? <span lang="zh-Hant-TW">哪個詞是這個意思？</span>
            </>
          )}
        </p>
      </div>

      <div className="card-surface flex flex-col items-center justify-center px-4 py-5 text-center">
        <p
          className="text-2xl font-bold text-brand-700 dark:text-brand-300"
          data-testid="meaning-cue"
        >
          {exercise.definition}
        </p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          {DOMAIN_LABELS[exercise.domain].en}{' '}
          <span lang="zh-Hant-TW">{DOMAIN_LABELS[exercise.domain].zh}</span>
        </p>
      </div>

      {phase === 'ear' && (
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Reading options">
          {exercise.readings.map((reading) => (
            <button
              key={reading}
              type="button"
              onClick={() => chooseReading(reading)}
              data-testid="meaning-reading"
              data-correct={reading === exercise.reading ? 'true' : 'false'}
              className="card-surface flex min-h-20 items-center justify-center px-2 text-lg font-semibold text-brand-700 transition-colors active:bg-stone-100 dark:text-brand-300 dark:active:bg-ink-3"
            >
              {reading}
            </button>
          ))}
        </div>
      )}

      {phase !== 'ear' && (
        <div className="card-surface px-4 py-3" aria-live="polite" data-testid="meaning-feedback">
          {heard !== null && !done && phase !== 'wrong' && !lastMisread && (
            <p className="text-sm text-stone-600 dark:text-stone-300" data-testid="meaning-ear">
              {heard ? (
                <>
                  <span className="font-semibold text-jade-600">By ear: yes.</span>{' '}
                  <span lang="zh-Hant-TW">聽得懂</span> — now find how it is written.
                </>
              ) : (
                <>
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    New to your ear too.
                  </span>{' '}
                  {wrongReading && (
                    <>
                      ‘{pickedReading}’ is <Hanzi>{wrongReading.traditional}</Hanzi>,{' '}
                      {wrongReading.definition}.{' '}
                    </>
                  )}
                  This word sounds ‘{exercise.reading}’ — now find how it is written.
                </>
              )}
            </p>
          )}
          {heard === null && phase === 'pick' && !lastMisread && (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Say the word to yourself, then read each option.
            </p>
          )}
          {lastMisread && !done && phase !== 'wrong' && phase !== 'retry' && (
            <p className="text-sm text-stone-700 dark:text-stone-200" data-testid="meaning-misread">
              <Hanzi className="font-semibold">{lastMisread}</Hanzi>
              {lastInfo && (
                <>
                  {' '}
                  is ‘{lastInfo.spoken ?? lastInfo.pinyin}’, {lastInfo.definition}
                </>
              )}{' '}
              — not this one. Pick again. <span lang="zh-Hant-TW">再選一次</span>
            </p>
          )}
          {phase === 'retry' && (
            <p
              className="text-sm font-semibold text-stone-700 dark:text-stone-200"
              data-testid="meaning-retry-hint"
            >
              {misses > 1 ? 'Once more — find it again.' : 'Now find it again.'}{' '}
              <span lang="zh-Hant-TW">再找一次</span>
            </p>
          )}
          {phase === 'gate' && (
            <p
              className="text-sm font-semibold text-stone-700 dark:text-stone-200"
              data-testid="meaning-gate-hint"
            >
              The word is <Hanzi className="text-jade-600">{exercise.answer}</Hanzi> — tap it to
              continue. <span lang="zh-Hant-TW">點一下正確答案</span>
            </p>
          )}
          {phase === 'wrong' && foil && (
            <div className="flex flex-col gap-2">
              <p className="font-bold text-red-600">
                <Hanzi>不對</Hanzi> — look at the{' '}
                {foilDiff.length === 1 ? ORDINALS[foilDiff[0].index] : 'highlighted'} character
              </p>
              <div className="flex items-center justify-around gap-2">
                <div className="text-center">
                  <p className="text-xs text-stone-500">you picked</p>
                  <Highlighted word={foil} indices={foilDiffIndices} tone="red" />
                </div>
                <span className="text-stone-600 dark:text-stone-300">→</span>
                <div className="text-center">
                  <p className="text-xs text-stone-500">the word is</p>
                  <Highlighted word={exercise.answer} indices={foilDiffIndices} tone="jade" />
                </div>
              </div>
              {foilDiff.length > 0 && (
                <div
                  className="text-sm text-stone-600 dark:text-stone-300"
                  data-testid="meaning-diff"
                >
                  {foilDiff.map((d) => {
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
                        <CharacterContrast picked={d.picked} correct={d.correct} />
                      </p>
                    );
                  })}
                </div>
              )}
              <Button size="sm" variant="outline" onClick={startRetry} data-testid="meaning-retry">
                {gated ? 'Show me the word 看答案' : 'Got it — try again 再找一次'}
              </Button>
            </div>
          )}
          {done && (
            <div className="flex flex-col gap-2">
              <p className="font-bold text-jade-600">
                <Hanzi>{firstTry ? '答對了！' : '找到了！'}</Hanzi>{' '}
                {firstTry ? 'Correct' : 'Found it'} —{' '}
                <span className="text-brand-700 dark:text-brand-300">{exercise.reading}</span>
                {card?.spoken && (
                  <span className="text-sm font-normal text-stone-500"> · {card.pinyin}</span>
                )}
              </p>
              <DrillOutcome card={card} correct={!foilPicked} applyRating={applyRating} />
              {exercise.sentence && (
                <ExampleSentence
                  sentence={exercise.sentence.traditional}
                  target={exercise.answer}
                  pinyin={exercise.sentence.pinyin}
                  translation={exercise.sentence.translation}
                  className="mt-1"
                />
              )}
            </div>
          )}
        </div>
      )}

      {phase !== 'ear' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="Word options">
            {options.map((option) => {
              const isAnswer = option === exercise.answer;
              const isFoil = option === foil;
              const retired = misreads.includes(option);
              const info = exercise.optionInfo[option];
              const showReading = revealedTiles.has(option);
              const canReveal = (retired || done) && info && !isAnswer && !showReading;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={
                    phase === 'wrong' ||
                    (phase === 'gate' && !isAnswer) ||
                    (done && !canReveal) ||
                    (retired && !canReveal)
                  }
                  onClick={() => (canReveal ? reveal(option) : pick(option))}
                  data-testid="meaning-option"
                  data-correct={isAnswer ? 'true' : 'false'}
                  data-foil={isFoil ? 'true' : 'false'}
                  className={cn(
                    'card-surface flex min-h-28 flex-col items-center justify-center gap-1 px-2 transition-colors',
                    !done &&
                      !retired &&
                      phase !== 'wrong' &&
                      'active:bg-stone-100 dark:active:bg-ink-3',
                    (done || phase === 'gate') && isAnswer && 'border-jade-500 bg-jade-500/15',
                    phase === 'wrong' && isFoil && 'border-red-500 bg-red-500/15',
                    retired && 'border-amber-500 bg-amber-500/15',
                    phase === 'gate' && !isAnswer && 'opacity-50',
                    done && !isAnswer && !retired && !showReading && 'opacity-80',
                  )}
                >
                  <Hanzi className={cn(big, 'font-bold')}>{option}</Hanzi>
                  {done && isFoil && (
                    <span className="text-[11px] font-normal text-stone-500 dark:text-stone-400">
                      {exercise.optionInfo[option] ? '' : '形近 look-alike'}
                    </span>
                  )}
                  {info && !isAnswer && (retired || done) && (
                    <span
                      className="text-[11px] font-normal text-stone-500 dark:text-stone-400"
                      data-testid="meaning-gloss"
                    >
                      {showReading
                        ? `${info.spoken ?? info.pinyin} · ${info.definition}`
                        : 'tap to check'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {done && (
            <Button
              block
              size="lg"
              onClick={() =>
                onComplete([
                  {
                    cardId: exercise.cardId,
                    correct: !foilPicked,
                    applyRating,
                    misses: misses + misreads.length,
                    ...(foilPicked && foil ? { picked: foil } : {}),
                    ...(!foilPicked && lastMisread ? { picked: lastMisread } : {}),
                    ...(heard !== null ? { heard } : {}),
                  },
                ])
              }
              data-testid="drill-continue"
            >
              Continue
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

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
