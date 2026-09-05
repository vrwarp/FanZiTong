import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { DailyChart } from '@/components/stats/DailyChart';
import { DomainMasteryBars } from '@/components/stats/DomainMasteryBars';
import { RetentionGauge } from '@/components/stats/RetentionGauge';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { charInfo } from '@/data/charInfo';
import { hanChars, syllablesPerCharacter } from '@/lib/util/pinyin';
import { useCardsOrEmpty, useReviewLogsOrEmpty } from '@/hooks/useCards';
import { useNow } from '@/hooks/useNow';
import { useSettings } from '@/hooks/useSettings';
import { createScheduler } from '@/lib/fsrs/scheduler';
import {
  RECALL_MIN_STUDY_DAYS,
  averageRetrievability,
  countStudyDays,
  dailySeries,
  domainMastery,
  findLeeches,
  hasEnoughRecallData,
  retentionRate,
  stateDistribution,
  totalLapses,
} from '@/lib/stats/analytics';
import { CARD_STATE_LABELS, CARD_STATE_ZH, type VocabCard } from '@/types';

/** Below this many answers a percentage is noise, so it is not shown. */
const MIN_ANSWERS_FOR_RATE = 10;

export default function StatsPage() {
  const navigate = useNavigate();
  const cards = useCardsOrEmpty();
  const logs = useReviewLogsOrEmpty();
  const { settings } = useSettings();
  const now = useNow();

  const model = useMemo(() => {
    const scheduler = createScheduler(settings, { enableFuzz: false });
    const ready = hasEnoughRecallData(logs);
    const logs30 = logs.filter(
      (l) => now.getTime() - new Date(l.reviewTimestamp).getTime() <= 30 * 86_400_000,
    );
    return {
      recallDataReady: ready,
      studyDays: countStudyDays(logs),
      retrievability: ready ? averageRetrievability(scheduler, cards, now) : null,
      answers30: logs30.length,
      retention30: retentionRate(logs30),
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
          <p className="font-bold">Recall now</p>
          <p className="text-stone-500 dark:text-stone-400">
            Probability you can recall a reviewed card right now. Target{' '}
            {Math.round(settings.targetRetention * 100)}%.
          </p>
          {!model.recallDataReady && (
            <p className="text-stone-500 dark:text-stone-400" data-testid="stats-recall-empty">
              Shows after {RECALL_MIN_STUDY_DAYS} study days · {model.studyDays} so far
            </p>
          )}
          <p className="mt-2 font-bold">Not-&quot;Again&quot; rate, 30 days</p>
          <p className="text-stone-500 dark:text-stone-400" data-testid="retention-30">
            {model.retention30 === null
              ? 'No answers yet'
              : model.answers30 < MIN_ANSWERS_FOR_RATE
                ? `Not enough answers yet (${model.answers30}/${MIN_ANSWERS_FOR_RATE})`
                : `${Math.round(model.retention30 * 100)}% of answers were not "Again"`}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3 text-center">
        <Tile label="Words" value={cards.length} testId="stat-cards" />
        <Tile label="Forgotten" value={model.lapses} testId="stat-lapses" />
        <Tile
          label="Keep slipping"
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
          className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs whitespace-nowrap text-stone-600 dark:text-stone-300"
          data-testid="state-distribution"
        >
          <li>
            ● {CARD_STATE_LABELS[0]} <span lang="zh-Hant-TW">{CARD_STATE_ZH[0]}</span>{' '}
            {model.states.new}
          </li>
          <li className="text-amber-700 dark:text-amber-300">
            ● {CARD_STATE_LABELS[1]} <span lang="zh-Hant-TW">{CARD_STATE_ZH[1]}</span>{' '}
            {model.states.learning}
          </li>
          <li className="text-jade-600">
            ● {CARD_STATE_LABELS[2]} <span lang="zh-Hant-TW">{CARD_STATE_ZH[2]}</span>{' '}
            {model.states.review}
          </li>
          <li className="text-red-600">
            ● {CARD_STATE_LABELS[3]} <span lang="zh-Hant-TW">{CARD_STATE_ZH[3]}</span>{' '}
            {model.states.relearning}
          </li>
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
          "Solid" = you'd still read it after a month.
        </p>
        <DomainMasteryBars mastery={model.mastery} cards={cards} />
      </section>

      <section className="card-surface p-4" aria-labelledby="leech-heading">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="leech-heading"
            className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400"
          >
            Words that keep slipping <span lang="zh-Hant-TW">常忘的字</span>
          </h2>
          <span className="shrink-0 text-xs text-stone-500">
            forgotten ≥ {settings.leechThreshold}×
          </span>
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
                <LeechRow key={card.id} card={card} />
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
              Practice these words
            </Button>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * A leech is a diagnosis of interference, so the row shows the discriminating
 * cues that already exist: each character with its reading and gloss, the
 * accepted spellings (so a variant is never counted as a miss), and the
 * look-alikes it is confused with.
 */
function LeechRow({ card }: { card: VocabCard }) {
  const [showReading, setShowReading] = useState(false);
  const chars = hanChars(card.traditional);
  const syllables = syllablesPerCharacter(card.traditional, card.pinyin);
  const variants = (card.variants ?? []).filter(Boolean);
  const foils = (card.visualFoils ?? []).filter(Boolean);
  const drill = `/drills/${foils.length > 0 ? 'foil_discrimination' : 'cloze'}?count=1&cards=${card.id}`;
  return (
    <li className="flex flex-col gap-1 py-2" data-testid="leech-row">
      <div className="flex items-center gap-3">
        <Link to={`/vocab/${card.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Hanzi className="text-2xl font-bold text-red-600">{card.traditional}</Hanzi>
          <span className="min-w-0 flex-1">
            <span className="block text-sm">{card.definition}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setShowReading((v) => !v)}
          className="shrink-0 rounded-full border border-stone-300 px-2 py-0.5 text-xs font-semibold text-stone-600 dark:border-stone-600 dark:text-stone-300"
          aria-expanded={showReading}
          data-testid="leech-reading"
        >
          {showReading ? (card.spoken ?? card.pinyin) : 'reading'}
        </button>
        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/40 dark:text-red-200">
          forgotten {card.fsrs.lapses}×
        </span>
      </div>
      <p className="text-xs text-stone-600 dark:text-stone-300" data-testid="leech-cues">
        {chars.map((ch, i) => {
          const info = charInfo(ch);
          return (
            <span key={`${ch}-${i}`} className="mr-2 inline-block">
              <Hanzi className="font-semibold">{ch}</Hanzi>
              {syllables?.[i] && ` ${syllables[i]}`}
              {info && ` “${info.gloss}”`}
            </span>
          );
        })}
      </p>
      {(variants.length > 0 || foils.length > 0) && (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          {variants.length > 0 && (
            <span className="mr-3">
              <span lang="zh-Hant-TW">也寫作</span> <Hanzi>{variants.join('、')}</Hanzi>
            </span>
          )}
          {foils.length > 0 && (
            <span>
              not <Hanzi>{foils.join(' / ')}</Hanzi>
            </span>
          )}
        </p>
      )}
      <Link
        to={drill}
        className="self-start text-xs font-semibold text-brand-600 underline dark:text-brand-300"
        data-testid="leech-practice"
      >
        Practice this word
      </Link>
    </li>
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
