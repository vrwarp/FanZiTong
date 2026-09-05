import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/hooks/useSettings';

const LearnPage = lazy(() => import('@/pages/LearnPage'));
const StudyPage = lazy(() => import('@/pages/StudyPage'));
const DrillsPage = lazy(() => import('@/pages/DrillsPage'));
const DrillRunnerPage = lazy(() => import('@/pages/DrillRunnerPage'));
const VocabPage = lazy(() => import('@/pages/VocabPage'));
const CardEditorPage = lazy(() => import('@/pages/CardEditorPage'));
const StatsPage = lazy(() => import('@/pages/StatsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

export default function App() {
  const bootstrap = useBootstrap();
  const { settings } = useSettings();
  useTheme(settings.theme);

  if (bootstrap.status === 'loading') {
    return <LoadingScreen message="Preparing your deck…" />;
  }
  if (bootstrap.status === 'error') {
    return (
      <LoadingScreen
        message={`Could not open the local database: ${bootstrap.error}. Try reloading, or check that private browsing is off.`}
      />
    );
  }

  return (
    <Suspense fallback={<LoadingScreen message="Loading…" />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<LearnPage />} />
          <Route path="drills" element={<DrillsPage />} />
          <Route path="vocab" element={<VocabPage />} />
          <Route path="vocab/new" element={<CardEditorPage />} />
          <Route path="vocab/:cardId" element={<CardEditorPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="study" element={<StudyPage />} />
        <Route path="drills/:drillType" element={<DrillRunnerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
