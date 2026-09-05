import type { ReactNode } from 'react';
import { DOMAIN_LABELS, type DomainCategory } from '@/types';
import { cn } from '@/lib/util/cn';

const DOMAIN_STYLES: Record<DomainCategory, string> = {
  food: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200',
  church: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
  slang: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  anime: 'bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/40 dark:text-fuchsia-200',
  custom: 'bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-100',
};

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DomainBadge({ domain, className }: { domain: DomainCategory; className?: string }) {
  const label = DOMAIN_LABELS[domain];
  return (
    <Badge className={cn(DOMAIN_STYLES[domain], className)}>
      <span aria-hidden>{label.emoji}</span>
      {label.en} / <span lang="zh-Hant-TW">{label.zh}</span>
    </Badge>
  );
}
