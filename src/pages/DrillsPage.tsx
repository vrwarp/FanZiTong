import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { inputClass } from '@/components/ui/Field';
import type { DrillType } from '@/lib/session/drillPlan';
import { DOMAIN_CATEGORIES, DOMAIN_LABELS, type DomainCategory } from '@/types';

const DRILLS: {
  type: DrillType;
  icon: string;
  title: string;
  zh: string;
  description: string;
  foodOnly?: boolean;
}[] = [
  {
    type: 'realia_menu',
    icon: '🧾',
    title: 'Menu Simulation',
    zh: '點菜單',
    description:
      'Scan a classic red-and-white order slip and tick the dishes that were ordered within 20 seconds.',
    foodOnly: true,
  },
  {
    type: 'cloze',
    icon: '✍️',
    title: 'Cloze Generator',
    zh: '填空',
    description:
      'Use your ear for grammar to pick the correctly written word that completes a real sentence.',
  },
  {
    type: 'foil_discrimination',
    icon: '🔍',
    title: 'Foil Drill',
    zh: '辨字',
    description:
      'Break the character-blur habit: choose the right shape among look-alike radicals and components.',
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
        subtitle="Standalone practice. Results still feed your FSRS schedule."
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
            <option value="all">All active domains</option>
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
        {DRILLS.map((drill) => (
          <li key={drill.type} className="card-surface flex gap-4 p-4">
            <span className="text-3xl" aria-hidden>
              {drill.icon}
            </span>
            <div className="flex flex-1 flex-col gap-2">
              <h2 className="text-lg font-bold">
                {drill.title}{' '}
                <span lang="zh-Hant-TW" className="hanzi text-brand-600 dark:text-brand-300">
                  {drill.zh}
                </span>
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-300">{drill.description}</p>
              {drill.foodOnly && (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Uses food-domain cards only.
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
        ))}
      </ul>
    </div>
  );
}
