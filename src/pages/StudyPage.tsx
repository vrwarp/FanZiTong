import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { DrillStep } from '@/components/study/DrillStep';
import { RecognitionCard } from '@/components/study/RecognitionCard';
import { SessionSummary } from '@/components/study/SessionSummary';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useCards, useReviewLogs } from '@/hooks/useCards';
import { computeDashboard } from '@/hooks/useDashboard';
import { useSettings } from '@/hooks/useSettings';
import { useStudyEngine } from '@/hooks/useStudyEngine';
import { createScheduler } from '@/lib/fsrs/scheduler';
import { StudyEngine, summarizeResults } from '@/lib/session/engine';
import { computeStreak, countDueWithin } from '@/lib/stats/analytics';
import type { RatingGrade, ReviewLog, UserSettings, VocabCard } from '@/types';

/** Journey 1: waits for the local data, then mounts the session exactly once. */
export default function StudyPage() {
  const cards = useCards();
  const logs = useReviewLogs();
  const { settings, loaded } = useSettings();
  if (!cards || !logs || !loaded) return <LoadingScreen message="Building your session…" />;
  return <StudySession initialCards={cards} logs={logs} settings={settings} />;
}

function StudySession({
  initialCards,
  logs,
  settings,
}: {
  initialCards: VocabCard[];
  logs: ReviewLog[];
  settings: UserSettings;
}) {
  const navigate = useNavigate();
  // The engine is created once from the data available at mount; later live
  // updates (caused by our own writes) must not rebuild the session.
  const [engine] = useState<StudyEngine | null>(() => {
    const model = computeDashboard(initialCards, logs, settings, new Date());
    if (model.plan.queue.length === 0) return null;
    return new StudyEngine({
      pool: initialCards,
      queue: model.plan.queue,
      scheduler: createScheduler(settings),
      interleaveDrills: true,
    });
  });
  const api = useStudyEngine(engine);
  const { snapshot } = api;
  const [paused, setPaused] = useState(false);

  // Keyboard shortcuts for desktop practice: space/enter reveal, 1-4 rate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || !snapshot || snapshot.step?.kind !== 'card') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        api.reveal();
      } else if (snapshot.revealed && ['1', '2', '3', '4'].includes(e.key)) {
        api.rate(Number(e.key) as RatingGrade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [snapshot, api, paused]);

  const weakCards = useMemo(() => {
    if (!engine || !snapshot) return [];
    return summarizeResults(snapshot.results)
      .weakCardIds.map((id) => engine.getCard(id))
      .filter((c): c is VocabCard => Boolean(c));
  }, [engine, snapshot]);

  if (!engine || !snapshot) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col p-4">
        <EmptyState
          icon="🎉"
          title="Nothing due right now"
          description="You are all caught up. Come back later, or run a drill from the Drills tab."
          action={<Button onClick={() => navigate('/')}>Back to Learn</Button>}
        />
      </div>
    );
  }

  if (snapshot.status === 'complete' || paused) {
    const now = new Date(snapshot.startedAt + snapshot.elapsedMs);
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col p-4">
        <SessionSummary
          mode={snapshot.status === 'complete' ? 'complete' : 'paused'}
          results={snapshot.results}
          elapsedMs={snapshot.elapsedMs}
          streak={Math.max(1, computeStreak(logs, now))}
          remaining={snapshot.remaining + (snapshot.step ? 1 : 0)}
          dueTomorrow={countDueWithin(engine.getCards(), now, 24)}
          weakCards={weakCards}
          onContinue={snapshot.status === 'complete' ? undefined : () => setPaused(false)}
          onDone={() => {
            api.finish();
            navigate('/');
          }}
        />
      </div>
    );
  }

  const isHiddenCard = snapshot.step?.kind === 'card' && !snapshot.revealed;

  return (
    // The whole screen is the tap target while the answer is hidden (one-thumb use).
    <div
      className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-3 p-4 pb-6"
      onClick={(e) => {
        if (!isHiddenCard) return;
        if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
        api.reveal();
      }}
      data-testid="study-screen"
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold text-stone-500 dark:text-stone-400"
          data-testid="study-status"
        >
          {snapshot.answered} answered · {snapshot.remaining} left
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPaused(true)}
          data-testid="study-finish"
        >
          End session
        </Button>
      </div>

      {api.saveError && (
        <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
          Could not save progress: {api.saveError}
        </p>
      )}

      {snapshot.step?.kind === 'card' && snapshot.card && (
        <RecognitionCard
          key={`${snapshot.card.id}-${snapshot.answered}`}
          card={snapshot.card}
          pool={initialCards}
          revealed={snapshot.revealed}
          previews={snapshot.previews}
          revealLatencyMs={snapshot.revealLatencyMs}
          onReveal={api.reveal}
          onRate={api.rate}
          autoRevealMs={settings.pinyinRevealDelayMs}
          position={snapshot.answered + 1}
          total={snapshot.total}
        />
      )}

      {snapshot.step?.kind === 'drill' && (
        <DrillStep
          exercise={snapshot.step.exercise}
          getCard={(id) => engine.getCard(id)}
          onComplete={api.answerDrill}
          onSkip={api.skipDrill}
        />
      )}
    </div>
  );
}
