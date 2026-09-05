import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-surface flex flex-col items-center gap-2 p-8 text-center">
      <span className="text-4xl" aria-hidden>
        {icon}
      </span>
      <p className="font-semibold">{title}</p>
      {description && <p className="text-sm text-stone-500 dark:text-stone-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
