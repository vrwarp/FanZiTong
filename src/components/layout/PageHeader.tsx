import type { ReactNode } from 'react';

export function PageHeader({
  title,
  zh,
  subtitle,
  action,
}: {
  title: string;
  zh?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {title}{' '}
          {zh && (
            <span lang="zh-Hant-TW" className="hanzi font-bold text-brand-600 dark:text-brand-300">
              {zh}
            </span>
          )}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  );
}
