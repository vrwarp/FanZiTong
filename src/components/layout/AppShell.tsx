import { Outlet } from 'react-router';
import { AppUpdateProvider } from '@/pwa/AppUpdateProvider';
import { ServiceWorkerPrompt } from '@/pwa/ServiceWorkerPrompt';
import { useOnlineStatus } from '@/pwa/useOnlineStatus';
import { BottomNav } from './BottomNav';

export function AppShell() {
  const online = useOnlineStatus();
  return (
    <AppUpdateProvider>
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
        {!online && (
          <div
            role="status"
            data-testid="offline-badge"
            className="safe-top bg-stone-800 px-4 py-1.5 text-center text-xs font-semibold text-white dark:bg-stone-200 dark:text-ink"
          >
            Offline — everything still works, your progress is saved on this device.
          </div>
        )}
        <main className="flex-1 px-4 pt-4 pb-24">
          <Outlet />
        </main>
        <BottomNav />
        <ServiceWorkerPrompt />
      </div>
    </AppUpdateProvider>
  );
}
