import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { coversTarget, type FindInTextExercise } from '@/lib/exercises/passage';
import type { DrillOutcome as DrillOutcomeType } from '@/lib/session/engine';
import { cn } from '@/lib/util/cn';
import { displayReading } from '@/lib/util/sentenceReadings';
import { DOMAIN_LABELS, type VocabCard } from '@/types';
import { DrillOutcome } from './DrillOutcome';

export interface FindInTextViewProps {
  exercise: FindInTextExercise;
  card?: VocabCard;
  onComplete: (outcomes: DrillOutcomeType[]) => void;
}

type Phase = 'pick' | 'gate' | 'done';

/** A tapped word, by sentence and position, so a retired one stays marked. */
type Tap = { sentence: number; index: number };

const sameTap = (a: Tap, b: Tap) => a.sentence === b.sentence && a.index === b.index;

/**
 * Mode 7: Find It. A few real sentences; tap the word that carries the
 * sound and meaning in the cue. The first wrong tap names the word tapped
 * and retires it, with no charge — a misreading of that word, not of the
 * target. A second wrong tap is a miss on the target: the word is shown
 * and has to be tapped once to go on.
 */
export function FindInTextView({ exercise, card, onComplete }: FindInTextViewProps) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [misreads, setMisreads] = useState<Tap[]>([]);
  const [misses, setMisses] = useState(0);
  const target = exercise.target;
  const done = phase === 'done';
  const missed = misses > 0;
  const firstTry = done && !missed && misreads.length === 0;
  const applyRating = firstTry || missed;
  const last = misreads.at(-1) ?? null;
  const lastWord = last ? exercise.sentences[last.sentence].words[last.index] : null;
  const lastInfo = lastWord ? exercise.wordInfo[lastWord.text] : undefined;

  const tap = (sentence: number, index: number) => {
    if (done) return;
    const word = exercise.sentences[sentence].words[index];
    const hit = sentence === target.sentence && coversTarget(word, target);
    if (phase === 'gate') {
      if (hit) setPhase('done');
      return;
    }
    if (hit) {
      setPhase('done');
      return;
    }
    const at = { sentence, index };
    if (misreads.some((m) => sameTap(m, at))) return;
    const next = [...misreads, at];
    setMisreads(next);
    // The second wrong tap is a miss on the target; the word is shown and tapped once.
    if (next.length >= 2) {
      setMisses((m) => m + 1);
      setPhase('gate');
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4" data-testid="find-exercise">
      <div>
        <p className="text-xs font-bold tracking-wide text-brand-600 uppercase dark:text-brand-300">
          Find It · <span lang="zh-Hant-TW">找字</span>
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Which word is this? Tap it in the text. <span lang="zh-Hant-TW">在句子裡找出這個詞</span>
        </p>
      </div>

      <div className="card-surface flex flex-col items-center justify-center px-4 py-4 text-center">
        <p className="text-3xl font-bold text-brand-700 dark:text-brand-300" data-testid="find-cue">
          ‘{exercise.reading}’
        </p>
        <p className="mt-1 text-lg text-stone-600 dark:text-stone-300">{exercise.definition}</p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          {DOMAIN_LABELS[exercise.domain].en}{' '}
          <span lang="zh-Hant-TW">{DOMAIN_LABELS[exercise.domain].zh}</span>
        </p>
      </div>

      <div className="card-surface flex flex-col gap-3 px-4 py-4" data-testid="find-passage">
        {exercise.sentences.map((sentence, si) => {
          const chars = Array.from(sentence.text);
          const nodes: React.ReactNode[] = [];
          let cursor = 0;
          sentence.words.forEach((w, wi) => {
            if (w.start > cursor) {
              nodes.push(<span key={`p-${wi}`}>{chars.slice(cursor, w.start).join('')}</span>);
            }
            const isTarget = si === target.sentence && coversTarget(w, target);
            const retired = misreads.some((m) => sameTap(m, { sentence: si, index: wi }));
            const shown = (done || phase === 'gate') && isTarget;
            nodes.push(
              <button
                key={`w-${wi}`}
                type="button"
                lang="zh-Hant-TW"
                disabled={done || retired || (phase === 'gate' && !isTarget)}
                onClick={() => tap(si, wi)}
                data-testid="find-word"
                data-target={isTarget ? 'true' : 'false'}
                className={cn(
                  'inline rounded px-0.5 transition-colors',
                  !done &&
                    !retired &&
                    phase !== 'gate' &&
                    'active:bg-stone-100 dark:active:bg-ink-3',
                  shown && 'bg-jade-500/15 font-semibold text-jade-600',
                  retired && 'bg-amber-500/15 text-amber-700 line-through dark:text-amber-300',
                  phase === 'gate' && !isTarget && !retired && 'opacity-50',
                )}
              >
                {w.text}
              </button>,
            );
            cursor = w.start + Array.from(w.text).length;
          });
          if (cursor < chars.length)
            nodes.push(<span key="tail">{chars.slice(cursor).join('')}</span>);
          return (
            <Hanzi
              key={si}
              className="block text-xl leading-loose"
              data-testid="find-sentence"
              data-target={si === target.sentence ? 'true' : 'false'}
            >
              {nodes}
            </Hanzi>
          );
        })}
      </div>

      <div className="card-surface px-4 py-3" aria-live="polite" data-testid="find-feedback">
        {phase === 'pick' && !last && (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Read each sentence the way you would a chat: word by word, until the one you want.
          </p>
        )}
        {phase === 'pick' && lastWord && (
          <p className="text-sm text-stone-700 dark:text-stone-200" data-testid="find-misread">
            <Hanzi className="font-semibold">{lastWord.text}</Hanzi> is ‘
            {lastInfo?.spoken ?? lastInfo?.pinyin ?? displayReading(lastWord.reading)}’
            {lastInfo && <>, {lastInfo.definition}</>} — not this one. Look again.{' '}
            <span lang="zh-Hant-TW">再找一次</span>
          </p>
        )}
        {phase === 'gate' && (
          <p
            className="text-sm font-semibold text-stone-700 dark:text-stone-200"
            data-testid="find-gate-hint"
          >
            {lastWord && (
              <>
                <Hanzi className="font-semibold">{lastWord.text}</Hanzi> is not it either.{' '}
              </>
            )}
            The word is <Hanzi className="text-jade-600">{card?.traditional ?? ''}</Hanzi> — tap it
            to continue. <span lang="zh-Hant-TW">點一下正確答案</span>
          </p>
        )}
        {done && (
          <div className="flex flex-col gap-1">
            <p className="font-bold text-jade-600">
              <Hanzi>{firstTry ? '答對了！' : '找到了！'}</Hanzi>{' '}
              {firstTry ? 'Correct' : 'Found it'} —{' '}
              <span className="text-brand-700 dark:text-brand-300">{exercise.reading}</span>
            </p>
            <DrillOutcome card={card} correct={!missed} applyRating={applyRating} />
            {exercise.sentences[target.sentence].translation && (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {exercise.sentences[target.sentence].translation}
              </p>
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
                correct: !missed,
                applyRating,
                misses: misreads.length,
                ...(misreads[0]
                  ? {
                      picked:
                        exercise.sentences[misreads[0].sentence].words[misreads[0].index].text,
                    }
                  : {}),
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
