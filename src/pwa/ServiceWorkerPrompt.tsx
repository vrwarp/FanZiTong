import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/Button';

/**
 * Registers the Workbox service worker and shows a small banner when a new
 * version has been precached ("prompt" update strategy), plus a one-time
 * confirmation that the app is ready to work offline.
 */
export function ServiceWorkerPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for updates periodically while the app stays open.
      if (registration) {
        setInterval(() => void registration.update(), 60 * 60 * 1000);
      }
    },
  });

  // "Ready to work offline" is not something the learner needs to act on: the
  // dashboard's first-run card already says the app works offline, so the
  // flag is simply cleared. An available update stays until acted on.
  useEffect(() => {
    if (offlineReady) setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh) return null;

  const close = () => setNeedRefresh(false);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="sw-banner"
      className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-stone-200 bg-white p-4 shadow-lg dark:border-stone-700 dark:bg-ink-2"
    >
      <p className="text-sm">A new version of 繁字通 is ready.</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={close}>
          Close
        </Button>
        <Button size="sm" onClick={() => void updateServiceWorker(true)}>
          Reload
        </Button>
      </div>
    </div>
  );
}
