import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { charInfo } from '@/data/charInfo';
import { clozeBlank, type ClozeExercise } from '@/lib/exercises/cloze';
import { diffCharacters } from '@/lib/exercises/foil';
import type { DrillOutcome as DrillOutcomeType } from '@/lib/session/engine';
import { cn } from '@/lib/util/cn';
import { mulberry32, shuffle } from '@/lib/util/random';
import type { VocabCard } from '@/types';
import { DrillOutcome } from './DrillOutcome';
import { ExampleSentence } from './ExampleSentence';
import { MAX_FOIL_MISSES } from './FoilExerciseView';

export interface ClozeExerciseViewProps {
  exercise: ClozeExercise;
  card: VocabCard;
  onComplete: (outcomes: DrillOutcomeType[]) => void;
}

const CORRECT_PHRASES = ['答對了！', '太強了！', '沒錯！'];
const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

type Phase = 'pick' | 'wrong' | 'retry' | 'gate' | 'done';

/**
 * Mode 2: contextual cloze (PRD §5.2). The sentence is the cue; the blank
 * has as many slots as the answer has characters; pinyin appears only in
 * feedback.
 *
 * Grading follows the evidence about the target word. Picking the look-alike
 * foil is a miss on the target (Again): the contrast is shown, then the word
 * has to be found again among reshuffled tiles, as in Spot the Character.
 * Picking a real word that does not belong in the sentence is a misreading of
 * the sentence, not of the target — it is explained, the tile is retired, and
 * the learner picks again with no schedule change.
 */
export function ClozeExerciseView({ exercise, card, onComplete }: ClozeExerciseViewProps) {
  const [phase, setPhase] = useState<Phase>('pick');
  /** Real words tried that did not fit (retired tiles). */
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
  const phrase = CORRECT_PHRASES[exercise.answer.length % CORRECT_PHRASES.length];
  const foilDiff = foil ? diffCharacters(foil, exercise.answer) : [];
  const foilDiffIndices = foilDiff.map((d) => d.index);
  const gated = misses >= MAX_FOIL_MISSES;

  const pick = (option: string) => {
    if (done || phase === 'wrong' || misreads.includes(option)) return;
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

  const blankText =
    phase === 'wrong'
      ? foil
      : done
        ? exercise.answer
        : (lastMisread ?? clozeBlank(exercise.answer));

  return (
    <div className="flex flex-1 flex-col gap-4" data-testid="cloze-exercise">
      <div>
        <p className="text-xs font-bold tracking-wide text-brand-600 uppercase dark:text-brand-300">
          Fill the Blank · <span lang="zh-Hant-TW">填空</span>
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Which word goes here? <span lang="zh-Hant-TW">哪個詞填得進去？</span>
        </p>
      </div>

      <div className="card-surface flex flex-1 flex-col justify-center px-4 py-6">
        <Hanzi
          className={cn(
            'block leading-relaxed',
            exercise.before.length + exercise.after.length <= 14 ? 'text-3xl' : 'text-2xl',
          )}
          data-testid="cloze-sentence"
        >
          {exercise.before}
          <span
            className={cn(
              'rounded-md border-b-4',
              done
                ? 'border-jade-500 text-jade-600'
                : phase === 'wrong'
                  ? 'border-red-500 text-red-600'
                  : lastMisread && phase === 'pick'
                    ? 'border-amber-500 text-amber-700 dark:text-amber-300'
                    : 'border-brand-400 text-brand-600',
            )}
            data-testid="cloze-blank"
          >
            {blankText}
          </span>
          {exercise.after}
        </Hanzi>
      </div>

      <div className="card-surface px-4 py-3" aria-live="polite" data-testid="cloze-feedback">
        {phase === 'pick' && !lastMisread && (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Read the whole sentence first.
          </p>
        )}
        {phase === 'pick' && lastMisread && (
          <div className="flex flex-col gap-1 text-sm" data-testid="cloze-misread">
            <p className="font-bold text-amber-700 dark:text-amber-300">
              {lastInfo ? (
                <>
                  That reads <Hanzi>{lastMisread}</Hanzi> {lastInfo.spoken ?? lastInfo.pinyin} —
                  right reading, wrong word here. Try again.
                </>
              ) : (
                <>
                  <Hanzi>{lastMisread}</Hanzi> does not fit this sentence. Try again.
                </>
              )}{' '}
              <span lang="zh-Hant-TW" className="font-normal">
                唸對了，但不是這句要的。
              </span>
            </p>
            {lastInfo && (
              <p className="text-stone-600 dark:text-stone-300" data-testid="cloze-misread-gloss">
                <Hanzi>{lastMisread}</Hanzi> = {lastInfo.definition}
              </p>
            )}
            {exercise.translation && (
              <p className="text-stone-600 dark:text-stone-300">Hint: {exercise.translation}</p>
            )}
          </div>
        )}
        {phase === 'retry' && (
          <p
            className="text-sm font-semibold text-stone-700 dark:text-stone-200"
            data-testid="cloze-retry-hint"
          >
            {misses > 1 ? 'Once more — find the word again.' : 'Now find the word again.'}{' '}
            <span lang="zh-Hant-TW">再找一次</span>
          </p>
        )}
        {phase === 'gate' && (
          <p
            className="text-sm font-semibold text-stone-700 dark:text-stone-200"
            data-testid="cloze-gate-hint"
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
              <div className="text-sm text-stone-600 dark:text-stone-300" data-testid="cloze-diff">
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
                    </p>
                  );
                })}
              </div>
            )}
            <Button size="sm" variant="outline" onClick={startRetry} data-testid="cloze-retry">
              {gated ? 'Show me the word 看答案' : 'Got it — try again 再找一次'}
            </Button>
          </div>
        )}
        {done && (
          <div className="flex flex-col gap-1.5 text-sm">
            <p
              className={cn(
                'font-bold',
                foilPicked ? 'text-stone-700 dark:text-stone-200' : 'text-jade-600',
              )}
            >
              <Hanzi>{firstTry ? phrase : '找到了！'}</Hanzi> {firstTry ? 'Correct' : 'Found it'}
            </p>
            <p className="text-lg font-semibold text-brand-700 dark:text-brand-300">
              {card.spoken ? `${card.spoken} · ` : ''}
              {card.pinyin} · {card.definition}
            </p>
            <ExampleSentence
              sentence={exercise.before + exercise.answer + exercise.after}
              target={exercise.answer}
              pinyin={exercise.sentencePinyin}
              translation={exercise.translation}
            />
            <DrillOutcome card={card} correct={!foilPicked} applyRating={applyRating} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Answer options">
          {options.map((option) => {
            const isAnswer = option === exercise.answer;
            const isFoil = option === foil;
            const info = exercise.optionInfo[option];
            const retired = misreads.includes(option);
            const showReading = retired || (done && (isAnswer || revealedTiles.has(option)));
            const inert =
              phase === 'wrong' ||
              retired ||
              (phase === 'gate' && !isAnswer) ||
              (done && !(info && !isAnswer && !showReading));
            return (
              <button
                key={option}
                type="button"
                disabled={inert}
                onClick={() => {
                  if (!done) pick(option);
                  else if (info && !isAnswer) setRevealedTiles((prev) => new Set(prev).add(option));
                }}
                data-testid="cloze-option"
                data-correct={isAnswer ? 'true' : 'false'}
                data-foil={isFoil ? 'true' : 'false'}
                data-kind={isAnswer ? 'answer' : isFoil ? 'foil' : 'word'}
                className={cn(
                  'card-surface flex min-h-24 flex-col items-center justify-center gap-0.5 px-3 text-xl font-semibold transition-colors',
                  !inert && !done && 'active:bg-stone-100 dark:active:bg-ink-3',
                  (done || phase === 'gate') && isAnswer && 'border-jade-500 bg-jade-500/15',
                  phase === 'wrong' && isFoil && 'border-red-500 bg-red-500/15',
                  retired && 'border-amber-500 bg-amber-500/15',
                  phase === 'gate' && !isAnswer && 'opacity-50',
                  done && !isAnswer && !retired && !showReading && 'opacity-80',
                )}
              >
                <Hanzi>{option}</Hanzi>
                {done && isFoil && (
                  <span className="text-[11px] font-normal text-stone-500 dark:text-stone-400">
                    形近 look-alike
                    {foilDiff[0] && charInfo(foilDiff[0].picked)
                      ? ` · ${foilDiff[0].picked} ${charInfo(foilDiff[0].picked)!.pinyin} “${charInfo(foilDiff[0].picked)!.gloss}” is not ${foilDiff[0].correct}${charInfo(foilDiff[0].correct) ? ` ${charInfo(foilDiff[0].correct)!.pinyin}` : ''}`
                      : ''}
                    {foilDiff[0] && charInfo(foilDiff[0].correct)?.tell
                      ? ` — ${charInfo(foilDiff[0].correct)!.tell}`
                      : ''}
                  </span>
                )}
                {info && !isAnswer && (retired || done) && (
                  <span
                    className="text-[11px] font-normal text-stone-500 dark:text-stone-400"
                    data-testid="cloze-gloss"
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
              onComplete([{ cardId: exercise.cardId, correct: !foilPicked, applyRating }])
            }
            data-testid="drill-continue"
          >
            Continue
          </Button>
        )}
      </div>
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
