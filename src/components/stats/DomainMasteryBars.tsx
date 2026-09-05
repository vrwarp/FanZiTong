import type { DomainMastery } from '@/lib/stats/analytics';
import { CardState, DOMAIN_LABELS, type VocabCard } from '@/types';

/**
 * Per-domain progress as three segments — not started / learning / solid —
 * so day-one effort is visible instead of a 0% bar that stays at 0% for weeks.
 */
export function DomainMasteryBars({
  mastery,
  cards,
}: {
  mastery: DomainMastery[];
  cards: VocabCard[];
}) {
  const rows = mastery.filter((m) => m.total > 0);
  if (rows.length === 0) return <p className="text-sm text-stone-500">No cards yet.</p>;
  return (
    <ul className="flex flex-col gap-3" data-testid="domain-mastery">
      {rows.map((m) => {
        const inDomain = cards.filter((c) => c.domain === m.domain);
        const notStarted = inDomain.filter((c) => c.fsrs.state === CardState.New).length;
        const solid = m.mastered;
        const learning = Math.max(0, m.total - notStarted - solid);
        const pct = (n: number) => `${(n / Math.max(1, m.total)) * 100}%`;
        return (
          <li key={m.domain}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">
                <span aria-hidden>{DOMAIN_LABELS[m.domain].emoji}</span>{' '}
                {DOMAIN_LABELS[m.domain].en}{' '}
                <span lang="zh-Hant-TW">{DOMAIN_LABELS[m.domain].zh}</span>
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {learning} learning · {solid} solid · {notStarted} not started
              </span>
            </div>
            <div
              className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
              role="img"
              aria-label={`${DOMAIN_LABELS[m.domain].en}: ${learning} learning, ${solid} solid, ${notStarted} not started`}
            >
              <div className="bg-jade-500" style={{ width: pct(solid) }} />
              <div className="bg-amber-brand" style={{ width: pct(learning) }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
