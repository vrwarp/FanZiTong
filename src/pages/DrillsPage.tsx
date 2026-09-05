import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { inputClass } from '@/components/ui/Field';
import type { DrillType } from '@/lib/session/drillPlan';
import { DOMAIN_CATEGORIES, DOMAIN_LABELS, EXERCISE_LABELS, type DomainCategory } from '@/types';

const DRILLS: { type: DrillType; icon: string; description: string; foodOnly?: boolean }[] = [
  {
    type: 'realia_menu',
    icon: '🧾',
    description:
      'A friend orders out loud; find the dishes on a real-looking red-and-white order slip before the timer runs out.',
    foodOnly: true,
  },
  {
    type: 'cloze',
    icon: '✍️',
    description:
      'Read a real sentence and pick the word that fits — your ear for grammar rules out the rest.',
  },
  {
    type: 'foil_discrimination',
    icon: '🔍',
    description:
      'Hear the word, pick the right shape among look-alikes. Breaks the character-blur habit.',
  },
];

export default function DrillsPage() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState<DomainCategory | 'all'>('all');
  const [count, setCount] = useState(5);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Drills"
        zh="練習"
        subtitle="Extra practice — answers here also change when each word comes back for review."
      />

      <div className="card-surface grid grid-cols-2 gap-3 p-4">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Domain
          <select
            className={inputClass}
            value={domain}
            onChange={(e) => setDomain(e.target.value as DomainCategory | 'all')}
            data-testid="drill-domain"
          >
            <option value="all">All domains</option>
            {DOMAIN_CATEGORIES.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABELS[d].en} {DOMAIN_LABELS[d].zh}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Questions
          <select
            className={inputClass}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            data-testid="drill-count"
          >
            {[3, 5, 10, 15].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="flex flex-col gap-3">
        {DRILLS.map((drill) => {
          const label = EXERCISE_LABELS[drill.type];
          return (
            <li key={drill.type} className="card-surface flex gap-4 p-4">
              <span className="text-3xl" aria-hidden>
                {drill.icon}
              </span>
              <div className="flex flex-1 flex-col gap-2">
                <h2 className="text-lg font-bold">
                  {label.en}{' '}
                  <span lang="zh-Hant-TW" className="hanzi text-brand-600 dark:text-brand-300">
                    {label.zh}
                  </span>
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-300">{drill.description}</p>
                {drill.foodOnly && (
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Uses food words only.
                  </p>
                )}
                <Button
                  className="self-start"
                  onClick={() => {
                    const params = new URLSearchParams({ count: String(count) });
                    if (domain !== 'all' && !drill.foodOnly) params.set('domain', domain);
                    navigate(`/drills/${drill.type}?${params.toString()}`);
                  }}
                  data-testid={`start-drill-${drill.type}`}
                >
                  Start
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
