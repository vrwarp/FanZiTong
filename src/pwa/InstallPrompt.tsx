import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'fzt-install-dismissed';

/** iOS Safari has no install event; the learner has to use Share → Add to Home Screen. */
function isIosBrowserTab(): boolean {
  try {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return ios && !standalone;
  } catch {
    return false;
  }
}

/** Android/desktop "Add to home screen" affordance (iOS uses Share → Add to Home Screen). */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const [ios] = useState(isIosBrowserTab);
  if (dismissed || (!event && !ios)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (!event) {
    return (
      <div className="card-surface flex items-center gap-3 p-3" data-testid="install-hint-ios">
        <span className="text-2xl" aria-hidden>
          📲
        </span>
        <p className="flex-1 text-sm">
          Add to Home Screen: tap Share, then “Add to Home Screen”. Opens full-screen and keeps your
          progress safe.
        </p>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Got it
        </Button>
      </div>
    );
  }

  return (
    <div className="card-surface flex items-center gap-3 p-3" data-testid="install-prompt">
      <span className="text-2xl" aria-hidden>
        📲
      </span>
      <p className="flex-1 text-sm">
        Install 繁字通 on your home screen for instant, offline study.
      </p>
      <Button variant="ghost" size="sm" onClick={dismiss}>
        Later
      </Button>
      <Button
        size="sm"
        onClick={async () => {
          await event.prompt();
          const choice = await event.userChoice;
          if (choice.outcome === 'accepted') setEvent(null);
        }}
      >
        Install
      </Button>
    </div>
  );
}
