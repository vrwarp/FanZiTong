import { ProgressBar } from '@/components/ui/ProgressBar';
import type { DomainMastery } from '@/lib/stats/analytics';
import { DOMAIN_LABELS } from '@/types';

export function DomainMasteryBars({ mastery }: { mastery: DomainMastery[] }) {
  const rows = mastery.filter((m) => m.total > 0);
  if (rows.length === 0) return <p className="text-sm text-stone-500">No cards yet.</p>;
  return (
    <ul className="flex flex-col gap-3" data-testid="domain-mastery">
      {rows.map((m) => (
        <li key={m.domain}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">
              <span aria-hidden>{DOMAIN_LABELS[m.domain].emoji}</span> {DOMAIN_LABELS[m.domain].en}{' '}
              <span lang="zh-Hant-TW">{DOMAIN_LABELS[m.domain].zh}</span>
            </span>
            <span className="text-stone-500 dark:text-stone-400">
              {m.mastered}/{m.total} · {m.percent}%
            </span>
          </div>
          <ProgressBar
            className="mt-1"
            value={m.percent}
            tone="jade"
            label={`${DOMAIN_LABELS[m.domain].en} mastery`}
          />
        </li>
      ))}
    </ul>
  );
}
