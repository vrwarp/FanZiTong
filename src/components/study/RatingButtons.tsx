import type { RatingPreview } from '@/lib/fsrs/scheduler';
import { cn } from '@/lib/util/cn';
import { RATING_LABELS, type RatingGrade } from '@/types';

export interface RatingButtonsProps {
  previews: Record<RatingGrade, RatingPreview> | null;
  onRate: (rating: RatingGrade) => void;
  /** When false the buttons keep their space (zero layout shift) but are inert. */
  visible: boolean;
  /** Seconds the learner needed before revealing, shown as a fluency hint. */
  latencyMs?: number | null;
  /** Show the full rubric under the buttons (first few reveals, or on demand). */
  showCoach?: boolean;
  /**
   * The word was already knocked down today: Again and Hard bring it back for
   * another look without reaching the scheduler, so they show no interval.
   */
  practice?: boolean;
}

// Backgrounds are chosen for ≥ 4.5:1 contrast with white text (WCAG AA).
const STYLES: Record<RatingGrade, string> = {
  1: 'bg-red-700 hover:bg-red-800 text-white',
  2: 'bg-amber-700 hover:bg-amber-800 text-white',
  3: 'bg-jade-600 hover:bg-jade-700 text-white',
  4: 'bg-sky-700 hover:bg-sky-800 text-white',
};

const RATING_RUBRIC: Record<RatingGrade, string> = {
  1: "didn't get it",
  2: 'slow, or only part of it',
  3: 'sound and meaning came',
  4: 'instant, like reading a chat',
};

/** Above ~5 s the word did not come fluently; nudge toward an honest "Hard". */
export const SLOW_REVEAL_MS = 5000;

export function RatingButtons({
  previews,
  onRate,
  visible,
  latencyMs,
  showCoach,
  practice = false,
}: RatingButtonsProps) {
  const slow = latencyMs !== null && latencyMs !== undefined && latencyMs >= SLOW_REVEAL_MS;
  const labelFor = (rating: RatingGrade): string => {
    if (practice && rating <= 2) return 'one more look';
    return previews?.[rating]?.intervalLabel ?? '';
  };
  const describe = (rating: RatingGrade): string =>
    practice && rating <= 2
      ? `${RATING_LABELS[rating]}: ${RATING_RUBRIC[rating]}. Already counted today; it comes back for one more look`
      : `${RATING_LABELS[rating]}: ${RATING_RUBRIC[rating]}. Next review ${labelFor(rating)}`;
  return (
    <div
      className={cn('flex flex-col gap-2', !visible && 'pointer-events-none invisible')}
      aria-hidden={!visible}
      data-testid="rating-buttons"
    >
      {showCoach && (
        <p
          className="text-[11px] leading-snug text-stone-500 dark:text-stone-400"
          data-testid="rating-coach"
        >
          <b>Again</b> = {RATING_RUBRIC[1]} · <b>Hard</b> = {RATING_RUBRIC[2]} · <b>Good</b> ={' '}
          {RATING_RUBRIC[3]} · <b>Easy</b> = {RATING_RUBRIC[4]}
        </p>
      )}
      <p className="flex items-baseline justify-between pr-7 text-xs font-semibold text-stone-600 dark:text-stone-300">
        <span>
          How well did you <em>read</em> it? <span lang="zh-Hant-TW">讀得如何？</span>
        </span>
        {latencyMs !== null && latencyMs !== undefined && (
          <span
            data-testid="reveal-latency"
            className={cn(slow && 'text-amber-700 dark:text-amber-300')}
          >
            {(latencyMs / 1000).toFixed(1)}s to answer{slow ? ' · slow? that is Hard' : ''}
          </span>
        )}
      </p>
      {practice && (
        <p
          className="text-[11px] leading-snug text-stone-600 dark:text-stone-300"
          data-testid="rating-practice"
        >
          Already counted as forgotten today <span lang="zh-Hant-TW">今天已經算過</span> — Again and
          Hard just bring it back; a pass still counts.
        </p>
      )}
      <div className="grid grid-cols-4 gap-2">
        {([1, 2, 3, 4] as const).map((rating) => {
          return (
            <button
              key={rating}
              type="button"
              data-testid={`rate-${rating}`}
              aria-label={describe(rating)}
              tabIndex={visible ? 0 : -1}
              onClick={() => onRate(rating)}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center rounded-xl font-bold shadow-sm transition-colors',
                STYLES[rating],
              )}
            >
              <span className="text-base leading-tight">{RATING_LABELS[rating]}</span>
              <span className="text-xs font-semibold" data-testid={`interval-${rating}`}>
                {labelFor(rating)}
              </span>
            </button>
          );
        })}
      </div>
      {!showCoach && (
        <p
          className="text-[11px] leading-snug text-stone-500 dark:text-stone-400"
          data-testid="rating-reminder"
        >
          <b>Hard</b> = {RATING_RUBRIC[2]} · rate the reading, not the word
        </p>
      )}
    </div>
  );
}
