import type { ReactNode } from 'react';
import { cn } from '@/lib/util/cn';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-stone-700 dark:text-stone-200">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-stone-500 dark:text-stone-400">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-ink placeholder:text-stone-400 focus:border-brand-500 dark:border-stone-600 dark:bg-ink-3 dark:text-stone-100';

export const textareaClass = `${inputClass} min-h-24 py-2`;
