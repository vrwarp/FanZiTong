import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/util/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary:
    'bg-stone-800 text-white hover:bg-stone-900 disabled:bg-stone-400 dark:bg-stone-100 dark:text-ink dark:hover:bg-white',
  ghost:
    'bg-transparent text-stone-700 hover:bg-stone-200/70 dark:text-stone-200 dark:hover:bg-stone-700/60',
  outline:
    'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-600 dark:bg-transparent dark:text-stone-100 dark:hover:bg-stone-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3 text-sm',
  md: 'min-h-12 px-4 text-base',
  lg: 'min-h-14 px-5 text-lg',
};

/** Touch-friendly button (48px minimum hit area at md/lg sizes). */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
