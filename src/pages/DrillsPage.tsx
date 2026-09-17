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
      'A friend tells you what they want; find those dishes on a real-looking red-and-white order slip before the timer runs out.',
    foodOnly: true,
  },
  {
    type: 'cloze',
    icon: '✍️',
    description: 'Read a real sentence and pick the word that fits.',
  },
  {
    type: 'foil_discrimination',
    icon: '🔍',
    description:
      'Read the sound and meaning, then pick the right characters among look-alikes. Breaks the character-blur habit.',
  },
  {
    type: 'meaning_to_form',
    icon: '💬',
    description:
      'Start from the meaning alone. First say the word to yourself — it asks now and then whether you know it by ear — then find how it is written among real words and one misspelling.',
  },
  {
    type: 'typed_reading',
    icon: '⌨️',
    description:
      'The characters alone; type the pinyin, tones optional. The one drill where you produce the reading yourself, so a first-try hit counts as a reading — it can move a word in review.',
  },
  {
    type: 'find_in_text',
    icon: '🔎',
    description:
      'A few real sentences, one of which uses the word. Given its sound and meaning, tap it in the text — reading the way a chat or a menu is read: skim, cut into words, spot.',
  },
  {
    type: 'sound_family',
    icon: '🧬',
    description:
      'The word with one character missing, and tiles that all share its sound part (＿嬌: 傲 敖 熬 遨). Only the other half of each character can settle it — the half that says what it means.',
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
        subtitle="Extra practice. A hit only speeds up words not yet in review; a miss brings the word back to read, and only your reading moves a word in review."
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
                    Food words only · each question is one slip of up to 3 dishes, fewer when your
                    food words run out.
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
