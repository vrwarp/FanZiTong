import { NavLink } from 'react-router';
import { cn } from '@/lib/util/cn';

const TABS = [
  { to: '/', label: 'Learn', zh: '學習', icon: '📖', end: true },
  { to: '/drills', label: 'Drills', zh: '練習', icon: '🎯', end: false },
  { to: '/vocab', label: 'Vocab', zh: '詞彙', icon: '🗂️', end: false },
  { to: '/stats', label: 'Stats', zh: '統計', icon: '📊', end: false },
  { to: '/settings', label: 'Settings', zh: '設定', icon: '⚙️', end: false },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur dark:border-stone-700 dark:bg-ink-2/95"
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold',
                  isActive
                    ? 'text-brand-600 dark:text-brand-300'
                    : 'text-stone-500 dark:text-stone-400',
                )
              }
            >
              <span className="text-xl leading-none" aria-hidden>
                {tab.icon}
              </span>
              <span>
                {tab.label} <span lang="zh-Hant-TW">{tab.zh}</span>
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
