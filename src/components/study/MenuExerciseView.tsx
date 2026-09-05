import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { MENU_SIZES } from '@/data/menuTemplate';
import {
  formatOrderPrompt,
  gradeMenuExercise,
  selectionKey,
  type MenuExercise,
  type MenuGrade,
} from '@/lib/exercises/menu';
import type { DrillOutcome } from '@/lib/session/engine';
import { cn } from '@/lib/util/cn';

export interface MenuExerciseViewProps {
  exercise: MenuExercise;
  onComplete: (outcomes: DrillOutcome[]) => void;
  /** Override the countdown (tests). */
  timeLimitMs?: number;
}

/** Mode 3: Taiwanese order-slip realia simulation (PRD §5.3) with a 20-second window. */
export function MenuExerciseView({ exercise, onComplete, timeLimitMs }: MenuExerciseViewProps) {
  const limit = timeLimitMs ?? exercise.timeLimitMs;
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [grade, setGrade] = useState<MenuGrade | null>(null);
  const [remainingMs, setRemainingMs] = useState(limit);
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Countdown: the timer (an external system) drives state; on expiry it auto-grades.
  useEffect(() => {
    if (grade) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, limit - (Date.now() - startedAt));
      setRemainingMs(left);
      if (left <= 0) {
        window.clearInterval(id);
        setGrade((current) => current ?? gradeMenuExercise(exercise, selectedRef.current));
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [limit, grade, exercise]);

  const prompt = useMemo(() => formatOrderPrompt(exercise.targets), [exercise.targets]);

  const toggle = (key: string) => {
    if (grade) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = () => setGrade(gradeMenuExercise(exercise, selected));
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div
      className="flex flex-1 flex-col gap-4"
      data-testid="menu-exercise"
      data-target-keys={exercise.targets.map((t) => t.key).join(',')}
    >
      <div>
        <p className="text-xs font-bold tracking-wide text-brand-600 uppercase dark:text-brand-300">
          Order slip · <span lang="zh-Hant-TW">點菜單</span>
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Tick exactly what was ordered before the timer runs out.
        </p>
      </div>

      <div className="card-surface px-4 py-3">
        <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">Order 點餐：</p>
        <Hanzi className="block text-xl font-bold" data-testid="menu-prompt">
          {prompt}
        </Hanzi>
        <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-stone-500">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
            role="timer"
            aria-label={`${seconds} seconds left`}
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-100',
                remainingMs < 5000 ? 'bg-red-500' : 'bg-brand-500',
              )}
              style={{ width: `${(remainingMs / limit) * 100}%` }}
            />
          </div>
          <span data-testid="menu-timer">{seconds}s</span>
        </div>
      </div>

      {/* The slip itself: red print on cream paper, like a 小吃店 order sheet. */}
      <div
        lang="zh-Hant-TW"
        className="hanzi rounded-lg border-2 border-brand-600 bg-[#fff8ec] p-3 text-brand-800 shadow-inner"
        data-testid="menu-slip"
      >
        <div className="mb-2 flex items-center justify-between border-b-2 border-brand-600 pb-1 text-sm font-bold">
          <span>阿婆小吃店 點菜單</span>
          <span>桌號：3</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {exercise.categories.map((category) => (
            <fieldset key={category.id} className="border border-brand-600/60">
              <legend className="mx-2 px-1 text-sm font-bold">{category.name}</legend>
              {category.sized && (
                <div className="flex justify-end gap-3 px-2 text-xs font-semibold">
                  {MENU_SIZES.map((size) => (
                    <span key={size} className="w-10 text-center">
                      {size}
                    </span>
                  ))}
                </div>
              )}
              <ul>
                {category.items.map((item) => {
                  const keys = category.sized
                    ? MENU_SIZES.map((size) => ({ size, key: selectionKey(item.id, size) }))
                    : [{ size: undefined, key: selectionKey(item.id) }];
                  const isTarget = exercise.targets.some((t) => t.itemId === item.id);
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        'flex min-h-12 items-center justify-between border-t border-dashed border-brand-600/40 px-2',
                        grade && isTarget && 'bg-jade-500/10',
                        grade && item.foilOf && 'bg-red-500/10',
                      )}
                      data-testid="menu-item"
                      data-label={item.label}
                    >
                      <span className="text-lg">{item.label}</span>
                      <span className="flex gap-3">
                        {keys.map(({ size, key }) => (
                          <label
                            key={key}
                            className="flex h-12 w-10 items-center justify-center"
                            aria-label={size ? `${item.label} ${size}` : item.label}
                          >
                            <input
                              type="checkbox"
                              className="h-6 w-6 accent-brand-600"
                              checked={selected.has(key)}
                              disabled={grade !== null}
                              onChange={() => toggle(key)}
                              data-testid="menu-checkbox"
                              data-key={key}
                            />
                          </label>
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
        </div>
      </div>

      <div
        className="card-surface min-h-16 px-4 py-3"
        aria-live="polite"
        data-testid="menu-feedback"
      >
        {grade === null ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {selected.size} box{selected.size === 1 ? '' : 'es'} ticked.
          </p>
        ) : (
          <div className="text-sm">
            <p className={cn('font-bold', grade.allCorrect ? 'text-jade-600' : 'text-red-600')}>
              {grade.allCorrect
                ? '老闆說：沒問題！ Perfect order.'
                : remainingMs <= 0 && selected.size === 0
                  ? "時間到！ Time's up."
                  : '老闆看不懂… Not quite.'}
            </p>
            <ul className="mt-1 space-y-0.5">
              {exercise.targets.map((t) => (
                <li key={t.key}>
                  <span aria-hidden>{grade.perCard[t.cardId] ? '✅' : '❌'}</span>{' '}
                  <Hanzi>{t.size ? `${t.label} (${t.size})` : t.label}</Hanzi>
                </li>
              ))}
              {grade.wrongSelections.length > 0 && (
                <li className="text-red-600">
                  {grade.wrongSelections.length} extra item
                  {grade.wrongSelections.length === 1 ? '' : 's'} ticked.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {grade === null ? (
        <Button block size="lg" onClick={submit} data-testid="menu-submit">
          Submit order 送單
        </Button>
      ) : (
        <Button
          block
          size="lg"
          onClick={() =>
            onComplete(
              exercise.targets.map((t) => ({ cardId: t.cardId, correct: grade.perCard[t.cardId] })),
            )
          }
          data-testid="drill-continue"
        >
          Continue
        </Button>
      )}
    </div>
  );
}
