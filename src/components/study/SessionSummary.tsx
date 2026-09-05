import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { summarizeResults, type SessionResultEntry } from '@/lib/session/engine';
import { formatSessionTime } from '@/lib/util/time';
import type { VocabCard } from '@/types';

export interface SessionSummaryProps {
  /** "complete" = queue cleared; "paused" = learner ended early. */
  mode: 'complete' | 'paused';
  results: SessionResultEntry[];
  elapsedMs: number;
  streak: number;
  /** Cards still queued when paused. */
  remaining?: number;
  /** Reviews due by the end of tomorrow (to set tomorrow's appointment). */
  dueTomorrow?: number;
  /** Cards rated Again/Hard on first sight, for one last look. */
  weakCards?: VocabCard[];
  onContinue?: () => void;
  onDone: () => void;
  doneLabel?: string;
  title?: string;
}

const PRAISE = ['讚啦！', '太強了！', '辛苦了！', '今天練完了！'];

/**
 * End-of-session screen (PRD Journey 1, step 6): closes the loop with what
 * was done, one more look at the weak words, and when to come back.
 */
export function SessionSummary({
  mode,
  results,
  elapsedMs,
  streak,
  remaining = 0,
  dueTomorrow,
  weakCards = [],
  onContinue,
  onDone,
  doneLabel,
  title,
}: SessionSummaryProps) {
  const summary = summarizeResults(results);
  const cardAnswers = results.filter((r) => r.exerciseType === 'rapid_recognition').length;
  const drillAnswers = results.length - cardAnswers;
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const praise = PRAISE[summary.uniqueCards % PRAISE.length];
  const heading = title ?? (mode === 'complete' ? 'Daily goal reached' : 'Paused');

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
      data-testid="session-summary"
    >
      <div>
        <p className="text-5xl" aria-hidden>
          {mode === 'complete' ? '🎉' : '⏸️'}
        </p>
        <h2 className="mt-2 text-2xl font-extrabold">{heading}</h2>
        <p lang="zh-Hant-TW" className="hanzi text-lg text-stone-500 dark:text-stone-400">
          {mode === 'complete' ? praise : `先休息一下 · 還剩 ${remaining} 張`}
        </p>
        {mode === 'paused' && (
          <p
            className="mt-1 text-sm text-stone-600 dark:text-stone-300"
            data-testid="summary-remaining"
          >
            {remaining} card{remaining === 1 ? '' : 's'} left in this session — saved, even if you
            leave.
          </p>
        )}
      </div>

      <dl className="grid w-full max-w-sm grid-cols-2 gap-3">
        <Stat label="Words seen" value={String(summary.uniqueCards)} testId="summary-cards" />
        <Stat
          label="Answers"
          value={String(summary.total)}
          note={`${summary.uniqueCards} word${summary.uniqueCards === 1 ? '' : 's'} · ${Math.max(0, cardAnswers - summary.uniqueCards)} re-asked · ${drillAnswers} drill item${drillAnswers === 1 ? '' : 's'}`}
          testId="summary-answers"
        />
        <Stat
          label="Right on first try"
          value={summary.uniqueCards ? `${summary.firstTryCorrect}/${summary.uniqueCards}` : '—'}
          testId="summary-retention"
        />
        <Stat label="Time" value={formatSessionTime(elapsedMs)} testId="summary-time" />
      </dl>

      {weakCards.length > 0 && (
        <div className="w-full max-w-sm text-left" data-testid="weak-words">
          <p className="text-xs font-bold text-stone-500 uppercase dark:text-stone-400">
            One more look — tap to check
          </p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {weakCards.map((card) => {
              const open = revealed.has(card.id);
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => setRevealed((prev) => new Set(prev).add(card.id))}
                    className="card-surface flex min-h-11 items-center gap-2 px-3"
                    data-testid="weak-word"
                  >
                    <Hanzi className="text-xl font-bold">{card.traditional}</Hanzi>
                    {open && (
                      <span className="text-xs text-brand-700 dark:text-brand-300">
                        {card.pinyin} · {card.definition}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p
        className="text-sm font-semibold text-amber-700 dark:text-amber-300"
        data-testid="summary-streak"
      >
        🔥 Streak: Day {streak}
        {dueTomorrow !== undefined && (
          <span
            className="block text-xs font-medium text-stone-500 dark:text-stone-400"
            data-testid="summary-next"
          >
            {mode === 'paused'
              ? `Today 今天: ${remaining} card${remaining === 1 ? '' : 's'} left — continue when you're ready.`
              : dueTomorrow > 0
                ? `Tomorrow 明天: ${dueTomorrow} review${dueTomorrow === 1 ? '' : 's'} due — do ${dueTomorrow === 1 ? 'it' : 'them'} to keep the streak.`
                : 'Come back tomorrow to keep the streak alive.'}
          </span>
        )}
      </p>

      <div className="flex w-full max-w-sm flex-col gap-2">
        {mode === 'paused' && onContinue && (
          <Button size="lg" onClick={onContinue} data-testid="summary-continue">
            Continue <span lang="zh-Hant-TW">繼續</span>
          </Button>
        )}
        <Button
          size="lg"
          variant={mode === 'paused' ? 'outline' : 'primary'}
          onClick={onDone}
          data-testid="summary-done"
        >
          {doneLabel ??
            (mode === 'complete' ? (
              <>
                Back to Learn <span lang="zh-Hant-TW">回首頁</span>
              </>
            ) : (
              <>
                Done for today <span lang="zh-Hant-TW">今天先這樣</span>
              </>
            ))}
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  testId,
}: {
  label: string;
  value: string;
  note?: string;
  testId: string;
}) {
  return (
    <div className="card-surface px-3 py-3">
      <dt className="text-xs font-semibold text-stone-500 uppercase dark:text-stone-400">
        {label}
      </dt>
      <dd className="text-2xl font-extrabold" data-testid={testId}>
        {value}
      </dd>
      {note && <dd className="text-[11px] text-stone-500 dark:text-stone-400">{note}</dd>}
    </div>
  );
}
