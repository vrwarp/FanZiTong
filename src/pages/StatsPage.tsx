import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { DailyChart } from '@/components/stats/DailyChart';
import { DomainMasteryBars } from '@/components/stats/DomainMasteryBars';
import { RetentionGauge } from '@/components/stats/RetentionGauge';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { useCardsOrEmpty, useReviewLogsOrEmpty } from '@/hooks/useCards';
import { useNow } from '@/hooks/useNow';
import { useSettings } from '@/hooks/useSettings';
import { createScheduler } from '@/lib/fsrs/scheduler';
import {
  averageRetrievability,
  dailySeries,
  domainMastery,
  findLeeches,
  hasEnoughRecallData,
  retentionRate,
  stateDistribution,
  totalLapses,
} from '@/lib/stats/analytics';

export default function StatsPage() {
  const navigate = useNavigate();
  const cards = useCardsOrEmpty();
  const logs = useReviewLogsOrEmpty();
  const { settings } = useSettings();
  const now = useNow();

  const model = useMemo(() => {
    const scheduler = createScheduler(settings, { enableFuzz: false });
    const ready = hasEnoughRecallData(logs);
    return {
      recallDataReady: ready,
      retrievability: ready ? averageRetrievability(scheduler, cards, now) : null,
      retention30: retentionRate(
        logs.filter(
          (l) => now.getTime() - new Date(l.reviewTimestamp).getTime() <= 30 * 86_400_000,
        ),
      ),
      series: dailySeries(logs, 30, now),
      mastery: domainMastery(cards),
      leeches: findLeeches(cards, settings.leechThreshold),
      lapses: totalLapses(cards),
      states: stateDistribution(cards),
    };
  }, [cards, logs, settings, now]);

  const total = Math.max(1, cards.length);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Stats" zh="統計" subtitle="How well the words are sticking" />

      <section className="card-surface flex items-center gap-4 p-4">
        <RetentionGauge value={model.retrievability} target={settings.targetRetention} />
        <div className="flex-1 text-sm">
          <p className="font-bold">Average retrievability</p>
          <p className="text-stone-500 dark:text-stone-400">
            Probability you can recall a reviewed card right now. Target{' '}
            {Math.round(settings.targetRetention * 100)}%.
          </p>
          <p className="mt-2 font-bold">30-day retention</p>
          <p className="text-stone-500 dark:text-stone-400" data-testid="retention-30">
            {model.retention30 === null
              ? 'No reviews yet'
              : `${Math.round(model.retention30 * 100)}% of answers were not "Again"`}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3 text-center">
        <Tile label="Cards" value={cards.length} testId="stat-cards" />
        <Tile label="Lapses" value={model.lapses} testId="stat-lapses" />
        <Tile
          label="Leeches"
          value={model.leeches.length}
          testId="stat-leeches"
          tone={model.leeches.length > 0 ? 'red' : undefined}
        />
      </section>

      <section className="card-surface p-4">
        <h2 className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400">
          Card states
        </h2>
        <div
          className="mt-2 flex h-3 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
          aria-hidden
        >
          <div className="bg-stone-400" style={{ width: `${(model.states.new / total) * 100}%` }} />
          <div
            className="bg-amber-brand"
            style={{ width: `${(model.states.learning / total) * 100}%` }}
          />
          <div
            className="bg-jade-500"
            style={{ width: `${(model.states.review / total) * 100}%` }}
          />
          <div
            className="bg-red-500"
            style={{ width: `${(model.states.relearning / total) * 100}%` }}
          />
        </div>
        <ul
          className="mt-2 grid grid-cols-4 gap-1 text-xs text-stone-600 dark:text-stone-300"
          data-testid="state-distribution"
        >
          <li>● Not started {model.states.new}</li>
          <li className="text-amber-700 dark:text-amber-300">● Learning {model.states.learning}</li>
          <li className="text-jade-600">● Reviewing {model.states.review}</li>
          <li className="text-red-600">● Relearning {model.states.relearning}</li>
        </ul>
      </section>

      <section className="card-surface p-4">
        <h2 className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400">
          Last 30 days
        </h2>
        <DailyChart series={model.series} />
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Bars: answers per day · Line: daily retention (dashed = 90%)
        </p>
      </section>

      <section className="card-surface p-4">
        <h2 className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400">
          Domain mastery
        </h2>
        <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
          Cards with stability over 30 days.
        </p>
        <DomainMasteryBars mastery={model.mastery} cards={cards} />
      </section>

      <section className="card-surface p-4" aria-labelledby="leech-heading">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="leech-heading"
            className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400"
          >
            Leech inspection
          </h2>
          <span className="text-xs text-stone-500">≥ {settings.leechThreshold} lapses</span>
        </div>
        {model.leeches.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400" data-testid="no-leeches">
            Nothing keeps slipping. Keep it up!
          </p>
        ) : (
          <>
            <ul
              className="mt-2 divide-y divide-stone-200 dark:divide-stone-700"
              data-testid="leech-list"
            >
              {model.leeches.map((card) => (
                <li key={card.id} className="flex items-center gap-3 py-2">
                  <Link to={`/vocab/${card.id}`} className="flex flex-1 items-center gap-3">
                    <Hanzi className="text-2xl font-bold text-red-600">{card.traditional}</Hanzi>
                    <span className="min-w-0 flex-1 truncate text-sm">{card.definition}</span>
                  </Link>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/40 dark:text-red-200">
                    forgotten {card.fsrs.lapses}×
                  </span>
                  {card.visualFoils && card.visualFoils.length > 0 && (
                    <Hanzi className="hidden text-sm text-stone-500 sm:inline">
                      vs {card.visualFoils.join(' / ')}
                    </Hanzi>
                  )}
                </li>
              ))}
            </ul>
            <Button
              className="mt-3"
              block
              onClick={() =>
                navigate(
                  `/drills/foil_discrimination?count=${model.leeches.length}&cards=${model.leeches.map((c) => c.id).join(',')}`,
                )
              }
              data-testid="practice-leeches"
            >
              Practice Difficult Characters
            </Button>
          </>
        )}
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  testId,
  tone,
}: {
  label: string;
  value: number;
  testId: string;
  tone?: 'red';
}) {
  return (
    <div className="card-surface px-2 py-3">
      <p className="text-xs font-semibold text-stone-500 uppercase dark:text-stone-400">{label}</p>
      <p
        className={`text-2xl font-extrabold ${tone === 'red' ? 'text-red-600' : ''}`}
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}
