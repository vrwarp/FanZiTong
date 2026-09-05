import { cn } from '@/lib/util/cn';

export interface ProgressBarProps {
  /** 0-100 */
  value: number;
  label?: string;
  className?: string;
  tone?: 'brand' | 'jade' | 'amber' | 'stone';
}

const TONES = {
  brand: 'bg-brand-600',
  jade: 'bg-jade-500',
  amber: 'bg-amber-brand',
  stone: 'bg-stone-500',
};

export function ProgressBar({ value, label, className, tone = 'brand' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className={cn(
        'h-2.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700',
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', TONES[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
