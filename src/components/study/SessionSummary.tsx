import { Button } from '@/components/ui/Button';
import { summarizeResults, type SessionResultEntry } from '@/lib/session/engine';
import { formatDuration } from '@/lib/util/time';

export interface SessionSummaryProps {
  title: string;
  results: SessionResultEntry[];
  elapsedMs: number;
  streak: number;
  onDone: () => void;
  doneLabel?: string;
}

/** Celebration screen at the end of a session (PRD Journey 1, step 6). */
export function SessionSummary({
  title,
  results,
  elapsedMs,
  streak,
  onDone,
  doneLabel = 'Back to Learn',
}: SessionSummaryProps) {
  const summary = summarizeResults(results);
  const retention = summary.retention === null ? '—' : `${Math.round(summary.retention * 100)}%`;
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
      data-testid="session-summary"
    >
      <div>
        <p className="text-5xl" aria-hidden>
          🎉
        </p>
        <h2 className="mt-2 text-2xl font-extrabold">{title}</h2>
        <p lang="zh-Hant-TW" className="hanzi text-lg text-stone-500 dark:text-stone-400">
          做得好！
        </p>
      </div>
      <dl className="grid w-full max-w-sm grid-cols-2 gap-3">
        <Stat label="Cards reviewed" value={String(summary.uniqueCards)} testId="summary-cards" />
        <Stat label="Answers" value={String(summary.total)} testId="summary-answers" />
        <Stat label="Retention" value={retention} testId="summary-retention" />
        <Stat label="Time" value={formatDuration(elapsedMs)} testId="summary-time" />
      </dl>
      <p
        className="text-sm font-semibold text-amber-700 dark:text-amber-300"
        data-testid="summary-streak"
      >
        🔥 Streak: Day {streak}
      </p>
      <Button size="lg" onClick={onDone} data-testid="summary-done">
        {doneLabel}
      </Button>
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="card-surface px-3 py-3">
      <dt className="text-xs font-semibold text-stone-500 uppercase dark:text-stone-400">
        {label}
      </dt>
      <dd className="text-2xl font-extrabold" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
