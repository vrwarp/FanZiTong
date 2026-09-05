import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { META_KEYS, repository } from '@/db/repository';
import { countStudyDays } from '@/lib/stats/analytics';
import { PageHeader } from '@/components/layout/PageHeader';
import { RetentionGauge } from '@/components/stats/RetentionGauge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useCardsOrEmpty, useReviewLogsOrEmpty } from '@/hooks/useCards';
import { useDashboard } from '@/hooks/useDashboard';
import { useNow } from '@/hooks/useNow';
import { useSettings } from '@/hooks/useSettings';
import { InstallPrompt } from '@/pwa/InstallPrompt';
import { DOMAIN_CATEGORIES, DOMAIN_LABELS } from '@/types';

const HOW_IT_WORKS_KEY = 'fzt-howitworks-dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(HOW_IT_WORKS_KEY) === '1';
  } catch {
    return false;
  }
}

export default function LearnPage() {
  const navigate = useNavigate();
  const cards = useCardsOrEmpty();
  const logs = useReviewLogsOrEmpty();
  const { settings } = useSettings();
  const now = useNow();
  const model = useDashboard(cards, logs, settings, now);
  const { plan } = model;
  const canStudy = plan.queue.length > 0;
  const [howDismissed, setHowDismissed] = useState(readDismissed);
  const showReviewsBar = model.reviewsToday > 0 || plan.dueReviewCount > 0;
  const lastBackupAt = useLiveQuery(() => repository.getMeta(META_KEYS.lastBackupAt), []);
  const studyDays = countStudyDays(logs);
  const backupAgeDays = lastBackupAt
    ? Math.floor((now.getTime() - new Date(lastBackupAt).getTime()) / 86_400_000)
    : null;
  const needsBackup = studyDays >= 14 && (backupAgeDays === null || backupAgeDays >= 14);

  const dismissHow = () => {
    setHowDismissed(true);
    try {
      localStorage.setItem(HOW_IT_WORKS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="FanZiTong"
        zh="繁字通"
        subtitle={now.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
        action={
          <span
            className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold whitespace-nowrap text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            data-testid="streak-badge"
          >
            {model.streak > 0 ? `🔥 Day ${model.streak}` : '🔥 Start your streak'}
          </span>
        }
      />

      {!howDismissed && (
        <section
          className="card-surface border-brand-200 p-4 dark:border-brand-900"
          data-testid="how-it-works"
        >
          <h2 className="text-sm font-bold text-brand-700 uppercase dark:text-brand-300">
            How this works
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li>
              You see a word in{' '}
              <span lang="zh-Hant-TW" className="hanzi font-semibold">
                繁體字
              </span>{' '}
              — nothing else.
            </li>
            <li>Say it in your head: the sound and the meaning you already know.</li>
            <li>
              Tap to check. Pinyin stays hidden until then, on purpose — otherwise your eyes read
              the letters and skip the characters.
            </li>
          </ol>
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            About 10 minutes a day. Everything is saved on this phone and works offline.
          </p>
          <Button
            size="sm"
            className="mt-3"
            onClick={dismissHow}
            data-testid="how-it-works-dismiss"
          >
            Got it
          </Button>
        </section>
      )}

      <section className="card-surface p-5" aria-labelledby="today-heading">
        <h2
          id="today-heading"
          className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400"
        >
          {model.doneForToday ? 'Today' : 'Due today'}
        </h2>
        {model.doneForToday ? (
          <>
            <p className="mt-1 text-3xl font-extrabold" data-testid="due-summary">
              Done for today ✓
            </p>
            <p
              className="mt-1 text-sm text-stone-500 dark:text-stone-400"
              data-testid="estimated-time"
            >
              {model.dueTomorrow > 0
                ? `Tomorrow: ${model.dueTomorrow} review${model.dueTomorrow === 1 ? '' : 's'} due — do them to keep the streak.`
                : 'Come back tomorrow to keep the streak alive.'}
            </p>
            <Button
              block
              size="lg"
              variant="outline"
              className="mt-4"
              onClick={() => navigate('/drills')}
              data-testid="start-session"
            >
              Extra practice
            </Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-3xl font-extrabold" data-testid="due-summary">
              {plan.dueReviewCount} review{plan.dueReviewCount === 1 ? '' : 's'},{' '}
              {plan.newCardCount} new card
              {plan.newCardCount === 1 ? '' : 's'}
            </p>
            <p
              className="mt-1 text-sm text-stone-500 dark:text-stone-400"
              data-testid="estimated-time"
            >
              {canStudy ? `≈ ${plan.estimatedMinutes} min` : 'Nothing due right now.'}
              {!canStudy &&
                model.dueTomorrow > 0 &&
                ` Next: ${model.dueTomorrow} due within a day.`}
              {plan.totalDueCount > plan.dueReviewCount &&
                ` · ${plan.totalDueCount - plan.dueReviewCount} more waiting beyond today's limit`}
            </p>
            <Button
              block
              size="lg"
              className="mt-4"
              disabled={!canStudy}
              onClick={() => navigate('/study')}
              data-testid="start-session"
            >
              {canStudy ? 'Start Daily Session' : 'Nothing due'}
            </Button>
            {!canStudy && (
              <p className="mt-2 text-center text-sm">
                <Link
                  to="/drills"
                  className="font-semibold text-brand-600 underline dark:text-brand-300"
                >
                  Practice with a drill instead
                </Link>
              </p>
            )}
          </>
        )}
      </section>

      <InstallPrompt />

      {needsBackup && (
        <p
          className="card-surface flex items-center justify-between gap-3 px-4 py-3 text-sm"
          data-testid="backup-nudge"
        >
          <span>
            Back up your progress —{' '}
            {backupAgeDays === null ? 'never backed up' : `${backupAgeDays} days since last backup`}
            .
          </span>
          <Link
            to="/settings"
            className="font-semibold text-brand-600 underline dark:text-brand-300"
          >
            Export
          </Link>
        </p>
      )}

      <section className="grid grid-cols-2 gap-3">
        <div className="card-surface p-4">
          <p className="text-xs font-bold text-stone-500 uppercase dark:text-stone-400">Today</p>
          <p className="mt-1 text-sm" data-testid="today-new">
            New {model.newCardsToday}/{settings.maxDailyNewCards}
          </p>
          <ProgressBar
            className="mt-1"
            tone="jade"
            value={(model.newCardsToday / Math.max(1, settings.maxDailyNewCards)) * 100}
            label="New cards introduced today"
          />
          {showReviewsBar ? (
            <>
              <p className="mt-2 text-sm" data-testid="today-reviews">
                Reviews {model.reviewsToday}/{settings.maxDailyReviews}
              </p>
              <ProgressBar
                className="mt-1"
                tone="jade"
                value={(model.reviewsToday / Math.max(1, settings.maxDailyReviews)) * 100}
                label="Reviews done today"
              />
            </>
          ) : (
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">No reviews due yet.</p>
          )}
          <p
            className="mt-2 text-xs text-stone-500 dark:text-stone-400"
            data-testid="today-answers"
          >
            {model.answersToday} answer{model.answersToday === 1 ? '' : 's'} today
          </p>
        </div>
        <div className="card-surface flex flex-col items-center justify-center p-4">
          <RetentionGauge
            value={model.averageRetrievability}
            target={settings.targetRetention}
            size={110}
          />
          <p className="text-xs font-bold text-stone-500 uppercase dark:text-stone-400">
            Recall now
          </p>
          {!model.recallDataReady && (
            <p
              className="mt-1 text-center text-[11px] text-stone-500 dark:text-stone-400"
              data-testid="recall-empty"
            >
              Shows after 7 study days
            </p>
          )}
        </div>
      </section>

      <section className="card-surface p-4">
        <h2 className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400">
          Your deck
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {DOMAIN_CATEGORIES.map((domain) => {
            const count = cards.filter((c) => c.domain === domain).length;
            if (count === 0) return null;
            const active = settings.activeDomains.includes(domain);
            return (
              <li
                key={domain}
                className={`rounded-full px-3 py-1 text-sm ${active ? 'bg-stone-100 dark:bg-stone-800' : 'bg-stone-100 text-stone-600 line-through dark:bg-stone-800 dark:text-stone-400'}`}
              >
                <span aria-hidden>{DOMAIN_LABELS[domain].emoji}</span> {DOMAIN_LABELS[domain].en}{' '}
                <span lang="zh-Hant-TW">{DOMAIN_LABELS[domain].zh}</span> · {count}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          {model.totalCards} words
          {model.leechCount > 0 && ` · ${model.leechCount} keep slipping`} ·{' '}
          <Link to="/vocab" className="underline">
            manage vocabulary
          </Link>
        </p>
      </section>
    </div>
  );
}
