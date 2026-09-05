import type { RatingPreview } from '@/lib/fsrs/scheduler';
import { cn } from '@/lib/util/cn';
import { RATING_LABELS, type RatingGrade } from '@/types';

export interface RatingButtonsProps {
  previews: Record<RatingGrade, RatingPreview> | null;
  onRate: (rating: RatingGrade) => void;
  /** When false the buttons keep their space (zero layout shift) but are inert. */
  visible: boolean;
}

// Backgrounds are chosen for ≥ 4.5:1 contrast with white text (WCAG AA).
const STYLES: Record<RatingGrade, string> = {
  1: 'bg-red-700 hover:bg-red-800 text-white',
  2: 'bg-amber-700 hover:bg-amber-800 text-white',
  3: 'bg-jade-600 hover:bg-jade-700 text-white',
  4: 'bg-sky-700 hover:bg-sky-800 text-white',
};

export function RatingButtons({ previews, onRate, visible }: RatingButtonsProps) {
  return (
    <div
      className={cn('grid grid-cols-4 gap-2', !visible && 'pointer-events-none invisible')}
      aria-hidden={!visible}
      data-testid="rating-buttons"
    >
      {([1, 2, 3, 4] as const).map((rating) => {
        const interval = previews?.[rating]?.intervalLabel ?? '';
        return (
          <button
            key={rating}
            type="button"
            data-testid={`rate-${rating}`}
            aria-label={`${RATING_LABELS[rating]}, next review ${interval}`}
            tabIndex={visible ? 0 : -1}
            onClick={() => onRate(rating)}
            className={cn(
              'flex min-h-16 flex-col items-center justify-center rounded-xl font-bold shadow-sm transition-colors',
              STYLES[rating],
            )}
          >
            <span className="text-base leading-tight">{RATING_LABELS[rating]}</span>
            <span className="text-xs font-semibold" data-testid={`interval-${rating}`}>
              {interval}
            </span>
          </button>
        );
      })}
    </div>
  );
}
