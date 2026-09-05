import { Button } from '@/components/ui/Button';
import { useAppUpdate } from './appUpdateContext';

/**
 * Tells the learner a new version is waiting. It sits at the top, clear of the
 * sticky rating footer, and says progress is safe — a reload mid-session
 * resumes where they stopped, but they should not have to guess that.
 *
 * Dismissing only hides the banner: Settings still offers the update, because
 * a waiting worker never announces itself twice.
 */
export function ServiceWorkerPrompt() {
  const { updateReady, bannerDismissed, applyUpdate, dismissBanner } = useAppUpdate();
  if (!updateReady || bannerDismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="sw-banner"
      className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-2xl border border-stone-200 bg-white p-4 shadow-lg dark:border-stone-700 dark:bg-ink-2"
    >
      <p className="text-sm font-semibold">
        A new version of <span lang="zh-Hant-TW">繁字通</span> is ready.
      </p>
      <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
        Reloading keeps your progress — your deck and today&apos;s session are saved on this device.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={dismissBanner} data-testid="sw-later">
          Later
        </Button>
        <Button size="sm" onClick={applyUpdate} data-testid="sw-reload">
          Reload
        </Button>
      </div>
    </div>
  );
}
