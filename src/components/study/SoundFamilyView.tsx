import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { SOUND_MATCH_LABELS } from '@/lib/etymology';
import type { SoundFamilyExercise, SoundFamilyMember } from '@/lib/exercises/soundFamily';
import type { DrillOutcome as DrillOutcomeType } from '@/lib/session/engine';
import { cn } from '@/lib/util/cn';
import { mulberry32, shuffle } from '@/lib/util/random';
import type { VocabCard } from '@/types';
import { DrillOutcome } from './DrillOutcome';
import { MAX_FOIL_MISSES } from './FoilExerciseView';

export interface SoundFamilyViewProps {
  exercise: SoundFamilyExercise;
  card?: VocabCard;
  onComplete: (outcomes: DrillOutcomeType[]) => void;
}

type Phase = 'pick' | 'wrong' | 'retry' | 'gate' | 'done';

/**
 * Mode 8: Sound Families. The word with one character blanked, its reading
 * and meaning; the tiles all share that character's sound part, so the
 * meaning part is the only thing that can settle it. A wrong tile is
 * explained by what its meaning part says, then the character is found
 * again among reshuffled tiles, as in Spot the Character.
 */
export function SoundFamilyView({ exercise, card, onComplete }: SoundFamilyViewProps) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [picked, setPicked] = useState<string | null>(null);
  const [firstMiss, setFirstMiss] = useState<string | null>(null);
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
  const gated = misses >= MAX_FOIL_MISSES;
  const answer = exercise.memberInfo[exercise.answer];
  const wrong = picked && picked !== exercise.answer ? exercise.memberInfo[picked] : null;

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
    setFirstMiss((first) => first ?? option);
    setPhase('wrong');
  };

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
    <div className="flex flex-1 flex-col gap-4" data-testid="family-exercise">
      <div>
        <p className="text-xs font-bold tracking-wide text-brand-600 uppercase dark:text-brand-300">
          Sound Families · <span lang="zh-Hant-TW">聲旁</span>
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Which character completes the word? <span lang="zh-Hant-TW">缺的是哪個字？</span>
        </p>
      </div>

      <div className="card-surface flex flex-col items-center justify-center px-4 py-5 text-center">
        <Hanzi className="text-5xl font-bold tracking-wide" data-testid="family-cue">
          {exercise.masked}
        </Hanzi>
        <p className="mt-2 text-2xl font-semibold text-brand-700 dark:text-brand-300">
          {exercise.pinyin}
        </p>
        <p className="text-lg text-stone-600 dark:text-stone-300">{exercise.definition}</p>
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400" data-testid="family-stem">
          Every tile is built on <Hanzi className="font-semibold">{exercise.stem}</Hanzi>
          {exercise.stemReading && ` ${exercise.stemReading}`}, which gives the reading
          {exercise.match && ` (${SOUND_MATCH_LABELS[exercise.match]})`}. The other part says what
          it means.
        </p>
      </div>

      <div className="card-surface px-4 py-3" aria-live="polite" data-testid="family-feedback">
        {phase === 'pick' && (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            The sound is settled; look at what the rest of each character is about.
          </p>
        )}
        {phase === 'retry' && (
          <p
            className="text-sm font-semibold text-stone-700 dark:text-stone-200"
            data-testid="family-retry-hint"
          >
            {misses > 1 ? 'Once more — find' : 'Now find'} it again.{' '}
            <span lang="zh-Hant-TW">再找一次</span>
          </p>
        )}
        {phase === 'gate' && (
          <p
            className="text-sm font-semibold text-stone-700 dark:text-stone-200"
            data-testid="family-gate-hint"
          >
            The character is <Hanzi className="text-jade-600">{exercise.answer}</Hanzi> — tap it to
            continue. <span lang="zh-Hant-TW">點一下正確答案</span>
          </p>
        )}
        {phase === 'wrong' && wrong && (
          <div className="flex flex-col gap-2">
            <p className="font-bold text-red-600">
              <Hanzi>不對</Hanzi> — <Member member={wrong} tone="red" /> is not{' '}
              <Member member={answer} tone="jade" />
            </p>
            <Button size="sm" variant="outline" onClick={startRetry} data-testid="family-retry">
              {gated ? 'Show me the character 看答案' : 'Got it — try again 再找一次'}
            </Button>
          </div>
        )}
        {phase === 'done' && (
          <div className="flex flex-col gap-1">
            <p className="font-bold text-jade-600">
              <Hanzi>{correct ? '答對了！' : '找到了！'}</Hanzi> {correct ? 'Correct' : 'Found it'}{' '}
              — <Hanzi>{exercise.word}</Hanzi>
            </p>
            <p className="text-sm text-stone-600 dark:text-stone-300" data-testid="family-answer">
              <Member member={answer} tone="jade" />
            </p>
            <DrillOutcome card={card} correct={correct} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Character options">
          {options.map((option, i) => {
            const isAnswer = option === exercise.answer;
            const wide = options.length % 2 === 1 && i === options.length - 1;
            const isPicked = option === picked;
            const marked = phase === 'done' || phase === 'wrong';
            const info = exercise.memberInfo[option];
            return (
              <button
                key={option}
                type="button"
                disabled={marked || (phase === 'gate' && !isAnswer)}
                onClick={() => choose(option)}
                data-testid="family-option"
                data-correct={isAnswer ? 'true' : 'false'}
                className={cn(
                  'card-surface flex min-h-28 flex-col items-center justify-center gap-1 px-2 transition-colors',
                  wide && 'col-span-2',
                  !marked && 'active:bg-stone-100 dark:active:bg-ink-3',
                  (phase === 'done' || phase === 'gate') &&
                    isAnswer &&
                    'border-jade-500 bg-jade-500/15',
                  phase === 'gate' && !isAnswer && 'opacity-50',
                  phase === 'wrong' && isPicked && 'border-red-500 bg-red-500/15',
                  marked && !isPicked && !(phase === 'done' && isAnswer) && 'opacity-50',
                )}
              >
                <Hanzi className="text-5xl font-bold">{option}</Hanzi>
                {phase === 'done' && !isAnswer && info && (
                  <span
                    className="text-[11px] font-normal text-stone-500 dark:text-stone-400"
                    data-testid="family-gloss"
                  >
                    {describeShort(info)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {phase === 'done' && (
          <Button
            block
            size="lg"
            onClick={() =>
              onComplete([
                {
                  cardId: exercise.cardId,
                  correct,
                  misses,
                  ...(firstMiss ? { picked: firstMiss } : {}),
                },
              ])
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

/** "嬌 jiāo “delicate”, with 女 (woman)". */
function describeShort(member: SoundFamilyMember): string {
  const bits: string[] = [];
  if (member.reading) bits.push(member.reading);
  if (member.gloss) bits.push(`“${member.gloss}”`);
  if (member.meaningPart) {
    bits.push(
      member.meaningGloss ? `${member.meaningPart} (${member.meaningGloss})` : member.meaningPart,
    );
  }
  return bits.join(' · ');
}

function Member({ member, tone }: { member: SoundFamilyMember; tone: 'red' | 'jade' }) {
  return (
    <span data-testid="family-member">
      <Hanzi className={cn('font-semibold', tone === 'red' ? 'text-red-700' : 'text-jade-600')}>
        {member.char}
      </Hanzi>
      {member.reading && ` ${member.reading}`}
      {member.gloss && ` “${member.gloss}”`}
      {member.meaningPart && (
        <>
          , with <Hanzi className="font-semibold">{member.meaningPart}</Hanzi>
          {member.meaningGloss && ` (${member.meaningGloss})`}
        </>
      )}
      {member.word && (
        <>
          {' '}
          as in <Hanzi>{member.word}</Hanzi>
        </>
      )}
    </span>
  );
}
