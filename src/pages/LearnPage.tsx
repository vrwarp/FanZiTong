import { Link, useNavigate } from 'react-router';
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

export default function LearnPage() {
  const navigate = useNavigate();
  const cards = useCardsOrEmpty();
  const logs = useReviewLogsOrEmpty();
  const { settings } = useSettings();
  const now = useNow();
  const model = useDashboard(cards, logs, settings, now);
  const { plan } = model;
  const canStudy = plan.queue.length > 0;

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
            className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            data-testid="streak-badge"
          >
            🔥 Day {model.streak}
          </span>
        }
      />

      <section className="card-surface p-5" aria-labelledby="today-heading">
        <h2
          id="today-heading"
          className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400"
        >
          Due today
        </h2>
        <p className="mt-1 text-3xl font-extrabold" data-testid="due-summary">
          {plan.dueReviewCount} review{plan.dueReviewCount === 1 ? '' : 's'}, {plan.newCardCount}{' '}
          new card{plan.newCardCount === 1 ? '' : 's'}
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400" data-testid="estimated-time">
          {canStudy ? `≈ ${plan.estimatedMinutes} min` : 'All caught up for now.'}
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
      </section>

      <InstallPrompt />

      <section className="grid grid-cols-2 gap-3">
        <div className="card-surface p-4">
          <p className="text-xs font-bold text-stone-500 uppercase dark:text-stone-400">Today</p>
          <p className="mt-1 text-sm">
            Reviews {model.reviewsToday}/{settings.maxDailyReviews}
          </p>
          <ProgressBar
            className="mt-1"
            value={(model.reviewsToday / Math.max(1, settings.maxDailyReviews)) * 100}
            label="Reviews done today"
          />
          <p className="mt-2 text-sm">
            New {model.newCardsToday}/{settings.maxDailyNewCards}
          </p>
          <ProgressBar
            className="mt-1"
            tone="jade"
            value={(model.newCardsToday / Math.max(1, settings.maxDailyNewCards)) * 100}
            label="New cards introduced today"
          />
        </div>
        <div className="card-surface flex flex-col items-center justify-center p-4">
          <RetentionGauge
            value={model.averageRetrievability}
            target={settings.targetRetention}
            size={110}
          />
          <p className="text-xs font-bold text-stone-500 uppercase dark:text-stone-400">
            Memory health
          </p>
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
          {model.totalCards} cards · {model.leechCount} leech{model.leechCount === 1 ? '' : 'es'} ·{' '}
          <Link to="/vocab" className="underline">
            manage vocabulary
          </Link>
        </p>
      </section>
    </div>
  );
}
