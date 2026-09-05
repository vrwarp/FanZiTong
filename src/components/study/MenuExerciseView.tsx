import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { MENU_SIZES } from '@/data/menuTemplate';
import { repository } from '@/db/repository';
import { newFsrsState } from '@/lib/fsrs/scheduler';
import { uuid } from '@/lib/util/id';
import {
  cueReading,
  formatOrderPrompt,
  formatPrice,
  gradeMenuExercise,
  selectionKey,
  type MenuExercise,
  type MenuGrade,
} from '@/lib/exercises/menu';
import type { DrillOutcome as DrillOutcomeType } from '@/lib/session/engine';
import { cn } from '@/lib/util/cn';
import type { VocabCard } from '@/types';
import { DrillOutcome } from './DrillOutcome';
import { charInfo } from '@/data/charInfo';
import { diffCharacters } from '@/lib/exercises/foil';
import type { MenuTarget } from '@/lib/exercises/menu';

/**
 * Why the ticked neighbour is not the ordered dish: the differing character
 * with its reading when the two are the same length, both meanings otherwise.
 */
function neighbourContrast(picked: string, target: MenuTarget): string {
  if (Array.from(picked).length === Array.from(target.label).length) {
    const diffs = diffCharacters(picked, target.label);
    const parts = diffs.map((d) => {
      const a = charInfo(d.picked);
      const b = charInfo(d.correct);
      return `${d.picked}${a ? ` ${a.pinyin} “${a.gloss}”` : ''} — not ${d.correct}${b ? ` ${b.pinyin} “${b.gloss}”` : ''}`;
    });
    if (parts.length > 0) return `${parts.join(' · ')} — you wanted ${target.label}`;
  }
  return `you wanted ${target.label} ${cueReading(target)} · ${target.definition}`;
}

export interface MenuExerciseViewProps {
  exercise: MenuExercise;
  getCard?: (id: string) => VocabCard | undefined;
  onComplete: (outcomes: DrillOutcomeType[]) => void;
  /** Override the countdown (tests). */
  timeLimitMs?: number;
}

const BOSS_PHRASES = ['好～馬上來！', '好喔，等一下。', '沒問題！'];
/** The size is said, not shown: the columns on the slip are for the learner to read. */
const SIZE_READING: Record<string, string> = { 小: 'xiǎo', 大: 'dà' };

type RowVerdict = 'hit' | 'missed' | 'wrong' | 'size' | null;

/**
 * Mode 3: Taiwanese order-slip realia (PRD §5.3). The order arrives the way a
 * friend says it — sound + meaning — and the learner must READ the printed
 * slip to find the dishes within 20 seconds. Characters for the order are
 * shown only after grading.
 */
export function MenuExerciseView({
  exercise,
  getCard,
  onComplete,
  timeLimitMs,
}: MenuExerciseViewProps) {
  const limit = timeLimitMs ?? exercise.timeLimitMs;
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [grade, setGrade] = useState<MenuGrade | null>(null);
  const [remainingMs, setRemainingMs] = useState(limit);
  const [showMeaning, setShowMeaning] = useState(false);
  /** Rows whose reading line the learner flipped away from its default. */
  const [toggledRows, setToggledRows] = useState<Set<string>>(() => new Set());
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const selectedRef = useRef(selected);
  const firstProblemRef = useRef<HTMLLIElement | null>(null);
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

  // The moment of judgement must be on screen: bring the first row that needs
  // attention into view once graded.
  useEffect(() => {
    if (!grade) return;
    const el = firstProblemRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [grade]);

  const orderHanzi = useMemo(() => formatOrderPrompt(exercise.targets), [exercise.targets]);
  const itemsById = useMemo(() => {
    const map = new Map<string, { label: string; neighbourOf?: string; variantOf?: string }>();
    for (const c of exercise.categories) for (const item of c.items) map.set(item.id, item);
    return map;
  }, [exercise.categories]);

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

  /** Turn a filler row into a real card (tag 小吃店) so the slip feeds the deck. */
  const addToDeck = async (label: string, pinyin: string, gloss: string) => {
    if (await repository.findByTraditional(label)) {
      setAdded((prev) => new Set(prev).add(label));
      return;
    }
    const now = new Date().toISOString();
    await repository.putCard({
      id: uuid(),
      traditional: label,
      pinyin,
      definition: gloss,
      domain: 'food',
      tags: ['小吃店', 'menu'],
      fsrs: newFsrsState(),
      createdAt: now,
      updatedAt: now,
    });
    setAdded((prev) => new Set(prev).add(label));
  };
  const timedOut = grade !== null && remainingMs <= 0 && selected.size === 0;
  const boss = BOSS_PHRASES[exercise.targets.length % BOSS_PHRASES.length];
  const hits = grade ? exercise.targets.filter((t) => grade.perCard[t.cardId]).length : 0;
  const verdictLabel = !grade
    ? ''
    : grade.allCorrect
      ? 'Perfect order.'
      : timedOut
        ? "Time's up."
        : 'Not quite.';
  const verdictZh = !grade
    ? ''
    : grade.allCorrect
      ? `老闆娘：${boss}`
      : timedOut
        ? '時間到！'
        : '老闆娘：欸，你是不是點錯了？';

  /** What the grade says about one printed row. */
  const rowVerdict = (itemId: string, keys: string[]): RowVerdict => {
    if (!grade) return null;
    const target = exercise.targets.find((t) => t.itemId === itemId);
    if (keys.some((k) => grade.wrongSelections.includes(k))) return 'wrong';
    if (!target) return null;
    if (!grade.perCard[target.cardId]) return 'missed';
    if (grade.sizeErrors.some((t) => t.itemId === itemId)) return 'size';
    return 'hit';
  };
  const isProblemVerdict = (v: RowVerdict) => v === 'missed' || v === 'wrong' || v === 'size';
  const keysFor = (item: { id: string }, sized: boolean) =>
    sized ? MENU_SIZES.map((size) => selectionKey(item.id, size)) : [selectionKey(item.id)];
  const firstProblemId = grade
    ? (exercise.categories
        .flatMap((c) => c.items.map((item) => ({ item, sized: c.sized })))
        .find(({ item, sized }) => isProblemVerdict(rowVerdict(item.id, keysFor(item, sized))))
        ?.item.id ?? null)
    : null;

  return (
    <div
      className="flex flex-1 flex-col gap-3"
      data-testid="menu-exercise"
      data-target-keys={exercise.targets.map((t) => t.key).join(',')}
    >
      {/* Sticky brief: the order (as heard) and the clock stay in view while scrolling
          the slip; after grading the same strip carries the verdict. */}
      <div className="sticky top-0 z-10 -mx-4 bg-cream/95 px-4 pt-1 pb-2 backdrop-blur dark:bg-ink/95">
        <div className="flex items-center gap-3">
          <p className="shrink-0 text-xs font-bold tracking-wide text-brand-600 uppercase dark:text-brand-300">
            Order Slip · <span lang="zh-Hant-TW">點菜單</span>
          </p>
          {grade === null && (
            <>
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
              <span
                className="w-8 text-right text-xs font-semibold text-stone-500 tabular-nums"
                data-testid="menu-timer"
              >
                {seconds}s
              </span>
            </>
          )}
        </div>
        {grade === null ? (
          <div className="card-surface mt-1 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                Your friend orders <span lang="zh-Hant-TW">朋友點</span> — find it on the slip:
              </p>
              <button
                type="button"
                onClick={() => setShowMeaning((s) => !s)}
                className="shrink-0 text-[11px] font-semibold text-brand-700 underline dark:text-brand-300"
                aria-expanded={showMeaning}
                data-testid="menu-cue-meaning"
              >
                {showMeaning ? 'less' : 'meaning 意思'}
              </button>
            </div>
            <ol className="mt-0.5 flex flex-col gap-0.5" data-testid="menu-prompt">
              {exercise.targets.map((t) => (
                <li key={t.key} className="flex items-baseline gap-2 leading-tight">
                  <span className="shrink-0 text-base font-bold text-brand-700 dark:text-brand-300">
                    {cueReading(t)}
                    {t.size && (
                      <span className="ml-1 text-sm font-semibold text-stone-500 dark:text-stone-400">
                        ({SIZE_READING[t.size] ?? t.size})
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 text-xs text-stone-600 dark:text-stone-300',
                      !showMeaning && 'truncate',
                    )}
                  >
                    {t.definition}
                    {showMeaning && t.size ? (t.size === '小' ? ', small' : ', large') : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div
            className={cn(
              'card-surface mt-1 border-l-4 px-3 py-2',
              grade.allCorrect ? 'border-l-jade-500' : 'border-l-red-500',
            )}
            aria-live="polite"
            data-testid="menu-verdict"
          >
            <p
              className={cn(
                'text-sm font-bold',
                grade.allCorrect ? 'text-jade-600' : 'text-red-600',
              )}
            >
              <Hanzi>{verdictZh}</Hanzi> {verdictLabel}
            </p>
            <p className="text-xs text-stone-600 dark:text-stone-300">
              {hits} of {exercise.targets.length} read right
              {grade.wrongSelections.length > 0 &&
                ` · ${grade.wrongSelections.length} wrong tick${grade.wrongSelections.length === 1 ? '' : 's'}`}
              {grade.sizeErrors.length > 0 &&
                ` · ${grade.sizeErrors.length} wrong size (no penalty)`}
              {' · '}tap a row for its reading
            </p>
          </div>
        )}
      </div>

      {/* The slip itself: red print on cream paper, like a real 點菜單. */}
      <div
        lang="zh-Hant-TW"
        className="font-slip rounded-lg border-2 border-brand-600 bg-[#fff8ec] p-3 text-brand-800 shadow-inner"
        data-testid="menu-slip"
      >
        <div className="mb-2 flex items-center justify-between border-b-2 border-brand-600 pb-1 text-sm font-bold">
          <span>{exercise.shop.name} 點菜單</span>
          <span className="flex gap-3 text-xs font-semibold">
            <span>內用／外帶</span>
            <span>桌號 3</span>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {exercise.categories.map((category) => (
            <fieldset key={category.id} className="border border-brand-600/60">
              <legend className="mx-2 px-1 text-sm font-bold">{category.name}</legend>
              <div className="flex justify-end gap-3 px-2 text-xs font-semibold">
                <span className="mr-auto pl-1">品名 · 價格</span>
                {category.sized ? (
                  MENU_SIZES.map((size) => (
                    <span key={size} className="w-10 text-center">
                      {size}
                    </span>
                  ))
                ) : (
                  <span className="w-10 text-center">✓</span>
                )}
              </div>
              <ul>
                {category.items.map((item) => {
                  const keys = category.sized
                    ? MENU_SIZES.map((size) => ({ size, key: selectionKey(item.id, size) }))
                    : [{ size: undefined, key: selectionKey(item.id) }];
                  const verdict = rowVerdict(
                    item.id,
                    keys.map((k) => k.key),
                  );
                  const isProblem = isProblemVerdict(verdict);
                  const revealable = grade !== null && Boolean(item.pinyin);
                  // A wrongly ticked neighbour of a missed dish: name the character that differs.
                  const confusedTarget =
                    verdict === 'wrong' && item.neighbourOf
                      ? exercise.targets.find(
                          (t) => t.cardId === item.neighbourOf && !grade!.perCard[t.cardId],
                        )
                      : undefined;
                  const contrast = confusedTarget
                    ? neighbourContrast(item.label, confusedTarget)
                    : null;
                  const isOpen = revealable && isProblem !== toggledRows.has(item.id);
                  return (
                    <li
                      key={item.id}
                      ref={item.id === firstProblemId ? firstProblemRef : undefined}
                      className={cn(
                        'flex min-h-12 flex-col justify-center border-t border-dashed border-brand-600/40 px-2',
                        verdict === 'hit' && 'bg-jade-500/10',
                        verdict === 'size' && 'bg-jade-500/10',
                        verdict === 'wrong' && 'bg-red-500/10',
                        verdict === 'missed' && 'bg-amber-200/40',
                      )}
                      data-testid="menu-item"
                      data-label={item.label}
                      data-verdict={verdict ?? undefined}
                      onClick={() => {
                        if (!revealable) return;
                        setToggledRows((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-lg">{item.label}</span>
                          <span className="text-xs text-brand-700/80">
                            {formatPrice(item.price)}
                          </span>
                          {verdict === 'missed' && (
                            <span className="rounded-full bg-amber-300/70 px-1.5 font-sans text-[10px] font-bold text-amber-900">
                              Missed 漏點
                            </span>
                          )}
                          {verdict === 'wrong' && (
                            <span className="rounded-full bg-red-200 px-1.5 font-sans text-[10px] font-bold text-red-800">
                              Wrong 點錯
                            </span>
                          )}
                          {verdict === 'size' && (
                            <span className="rounded-full bg-stone-200 px-1.5 font-sans text-[10px] font-bold text-stone-700">
                              Wrong size 份量
                            </span>
                          )}
                          {grade && item.variantOf && (
                            <span className="rounded-full border border-brand-600/40 px-1.5 text-[10px]">
                              = {item.variantOf}
                            </span>
                          )}
                          {revealable && (
                            <span className="font-sans text-[10px] text-brand-700/70">
                              {isOpen ? '▾' : '▸'} 讀音
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 gap-3">
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
                      </div>
                      {isOpen && item.pinyin && (
                        <div
                          className="flex items-center justify-between pb-2 text-xs"
                          data-testid="menu-row-reveal"
                        >
                          <span className="min-w-0 flex-1 font-sans text-stone-700">
                            {item.spoken ? `${item.spoken} · ` : ''}
                            {item.pinyin} · {item.gloss}
                            {contrast && (
                              <span className="block text-red-700" data-testid="menu-contrast">
                                {contrast}
                              </span>
                            )}
                          </span>
                          {!item.cardId && (
                            <button
                              type="button"
                              disabled={added.has(item.label)}
                              onClick={(e) => {
                                e.stopPropagation();
                                void addToDeck(item.label, item.pinyin!, item.gloss ?? '');
                              }}
                              className="ml-2 min-h-9 shrink-0 rounded-full border border-brand-600 px-2 font-sans font-semibold whitespace-nowrap text-brand-700 disabled:opacity-60"
                              data-testid="menu-add-card"
                            >
                              {added.has(item.label) ? 'In your deck ✓' : '+ Add to deck 加入'}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
        </div>
      </div>

      {grade !== null && (
        <div className="card-surface px-4 py-3" data-testid="menu-feedback">
          <div className="text-sm">
            <p className={cn('font-bold', grade.allCorrect ? 'text-jade-600' : 'text-red-600')}>
              {verdictLabel} The order was{' '}
              <Hanzi className="font-semibold" data-testid="menu-order-hanzi">
                {orderHanzi}
              </Hanzi>
            </p>
            <ul className="mt-1 space-y-1">
              {exercise.targets.map((t) => {
                const ok = grade.perCard[t.cardId];
                const sizeSlip = grade.sizeErrors.some((s) => s.cardId === t.cardId);
                return (
                  <li key={t.key} className="flex flex-col">
                    <span>
                      <span aria-hidden>{ok ? '✅' : '❌'}</span>{' '}
                      <Hanzi className="font-semibold">
                        {t.size ? `${t.standard} (${t.size})` : t.standard}
                      </Hanzi>{' '}
                      <span className="text-stone-500">
                        {cueReading(t)}
                        {t.spoken ? ` · ${t.pinyin}` : ''}
                      </span>
                      {t.label !== t.standard && (
                        <span className="text-stone-500">
                          {' '}
                          — printed as <Hanzi>{t.label}</Hanzi> on this menu
                        </span>
                      )}
                      {sizeSlip && (
                        <span className="text-stone-500"> — right dish, wrong size column</span>
                      )}
                    </span>
                    <DrillOutcome card={getCard?.(t.cardId)} correct={ok} />
                  </li>
                );
              })}
              {grade.wrongSelections.length > 0 && (
                <li className="text-red-600">
                  Ticked by mistake:{' '}
                  <Hanzi>
                    {grade.wrongSelections
                      .map((key) => itemsById.get(key.split(':')[0])?.label ?? key)
                      .join('、')}
                  </Hanzi>
                </li>
              )}
            </ul>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Tap any dish on the slip to see how it is read — and add it to your deck.
            </p>
          </div>
        </div>
      )}

      {/* Sticky action bar so Submit is always one thumb away. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-auto bg-cream/95 px-4 pt-2 pb-3 backdrop-blur dark:bg-ink/95">
        {grade === null ? (
          <Button block size="lg" onClick={submit} data-testid="menu-submit">
            {selected.size} ticked · Submit order 送單
          </Button>
        ) : (
          <Button
            block
            size="lg"
            onClick={() =>
              onComplete(
                exercise.targets.map((t) => ({
                  cardId: t.cardId,
                  correct: grade.perCard[t.cardId],
                })),
              )
            }
            data-testid="drill-continue"
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
