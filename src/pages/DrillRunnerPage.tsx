import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { DrillStep } from '@/components/study/DrillStep';
import { SessionSummary } from '@/components/study/SessionSummary';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useCards, useReviewLogs } from '@/hooks/useCards';
import { useSettings } from '@/hooks/useSettings';
import { useStudyEngine } from '@/hooks/useStudyEngine';
import { createScheduler } from '@/lib/fsrs/scheduler';
import {
  buildDrillExercises,
  isDrillType,
  selectDrillCards,
  type DrillType,
} from '@/lib/session/drillPlan';
import { MENU_MAX_TARGETS } from '@/lib/exercises/menu';
import { StudyEngine } from '@/lib/session/engine';
import { computeStreak } from '@/lib/stats/analytics';
import {
  EXERCISE_LABELS,
  isDomainCategory,
  type DomainCategory,
  type ReviewLog,
  type UserSettings,
  type VocabCard,
} from '@/types';

interface DrillOptions {
  domain?: DomainCategory;
  count: number;
  onlyIds?: string[];
}

/** Standalone drill session launched from the Drills or Stats tabs. */
export default function DrillRunnerPage() {
  const navigate = useNavigate();
  const { drillType } = useParams();
  const [params] = useSearchParams();
  const cards = useCards();
  const logs = useReviewLogs();
  const { settings, loaded } = useSettings();

  if (!isDrillType(drillType)) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col p-4">
        <EmptyState
          icon="🤔"
          title="Unknown drill"
          action={<Button onClick={() => navigate('/drills')}>Back to Drills</Button>}
        />
      </div>
    );
  }
  if (!cards || !logs || !loaded) return <LoadingScreen message="Preparing drill…" />;

  const domainParam = params.get('domain');
  const cardsParam = params.get('cards');
  const options: DrillOptions = {
    domain: isDomainCategory(domainParam) ? domainParam : undefined,
    count: Math.min(30, Math.max(1, Number(params.get('count') ?? 5) || 5)),
    onlyIds: cardsParam ? cardsParam.split(',').filter(Boolean) : undefined,
  };

  return (
    <DrillSession
      key={`${drillType}-${params.toString()}`}
      drillType={drillType}
      options={options}
      initialCards={cards}
      logs={logs}
      settings={settings}
    />
  );
}

function DrillSession({
  drillType,
  options,
  initialCards,
  logs,
  settings,
}: {
  drillType: DrillType;
  options: DrillOptions;
  initialCards: VocabCard[];
  logs: ReviewLog[];
  settings: UserSettings;
}) {
  const navigate = useNavigate();
  const [engine] = useState<StudyEngine | null>(() => {
    // For the Order Slip a "question" is one slip of up to three dishes.
    const cardCount =
      drillType === 'realia_menu' ? Math.min(30, options.count * MENU_MAX_TARGETS) : options.count;
    const selected = selectDrillCards(initialCards, settings, {
      type: drillType,
      count: cardCount,
      now: new Date(),
      domain: options.domain,
      onlyIds: options.onlyIds,
    });
    const drills = buildDrillExercises(drillType, selected, initialCards);
    if (drills.length === 0) return null;
    return new StudyEngine({
      pool: initialCards,
      queue: [],
      drills,
      scheduler: createScheduler(settings),
      interleaveDrills: false,
    });
  });
  const api = useStudyEngine(engine);
  const { snapshot } = api;

  if (!engine || !snapshot) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col p-4">
        <EmptyState
          icon="🗂️"
          title="No cards fit this drill yet"
          description="Cloze drills need an example sentence, menu drills need food-domain cards, and foil drills need visual foils. Add some in the Vocab tab."
          action={<Button onClick={() => navigate('/drills')}>Back to Drills</Button>}
        />
      </div>
    );
  }

  if (snapshot.status === 'complete') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col p-4">
        <SessionSummary
          mode="complete"
          title={`${EXERCISE_LABELS[drillType].en} done`}
          results={snapshot.results}
          elapsedMs={snapshot.elapsedMs}
          streak={Math.max(
            1,
            computeStreak(logs, new Date(snapshot.startedAt + snapshot.elapsedMs)),
          )}
          onDone={() => navigate('/drills')}
          doneLabel="Back to Drills"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-3 p-4 pb-6">
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold text-stone-500 dark:text-stone-400"
          data-testid="drill-progress"
        >
          {EXERCISE_LABELS[drillType].en} · {snapshot.drillIndex} of {snapshot.drillTotal}
        </span>
        <Button variant="ghost" size="sm" onClick={api.finish} data-testid="drill-exit">
          End
        </Button>
      </div>
      {snapshot.requeued > 0 && (
        <p
          className="-mt-2 text-xs text-stone-500 dark:text-stone-400"
          data-testid="drill-requeue-note"
        >
          A missed word comes back before the end. <span lang="zh-Hant-TW">等一下會再考一次</span>
        </p>
      )}
      {snapshot.step?.kind === 'drill' && (
        <DrillStep
          key={`drill-${snapshot.drillIndex}`}
          exercise={snapshot.step.exercise}
          getCard={(id) => engine.getCard(id)}
          onComplete={api.answerDrill}
          onSkip={api.skipDrill}
        />
      )}
    </div>
  );
}
