import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/util/cn';

/** Traditional Chinese text with the Taiwan glyph stack and correct language tag. */
export function Hanzi({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span lang="zh-Hant-TW" className={cn('hanzi', className)} {...rest}>
      {children}
    </span>
  );
}
