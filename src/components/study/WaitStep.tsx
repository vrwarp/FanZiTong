import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';

export interface WaitStepProps {
  /** Epoch ms at which the next card may be shown. */
  until: number;
  /** How many cards are waiting out their gap. */
  waiting: number;
  /** Called once the gap has passed; the engine then serves the card. */
  onReady: () => void;
  onFinish: () => void;
}

function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * The session has nothing to show but a card answered moments ago. Rather
 * than serve it while its reading is still on the learner's retina — a pass
 * earned that way is a memory of the screen, not a reading — it waits out
 * the gap in the open, and says why.
 */
export function WaitStep({ until, waiting, onReady, onFinish }: WaitStepProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    // A backgrounded tab throttles timers; coming back must not leave the
    // countdown frozen on a number that has already passed.
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (now >= until) onReady();
  }, [now, until, onReady]);

  const remainingMs = until - now;

  return (
    <div
      className="card-surface flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center"
      data-testid="wait-step"
      data-waiting={waiting}
    >
      <p className="text-4xl" aria-hidden>
        ⏳
      </p>
      <h2 className="text-xl font-extrabold">
        Take a breath <span lang="zh-Hant-TW">深呼吸</span>
      </h2>
      <p className="text-lg font-semibold text-brand-700 dark:text-brand-300" aria-live="polite">
        {waiting === 1 ? 'One word comes' : `${waiting} words come`} back in{' '}
        <span data-testid="wait-countdown" className="tabular-nums">
          {formatCountdown(remainingMs)}
        </span>
      </p>
      <p className="max-w-xs text-sm text-stone-600 dark:text-stone-300">
        Reading it again straight away would only be remembering the screen. The minute is what
        makes the next look a real one.
      </p>
      <Button variant="outline" className="mt-2" onClick={onFinish} data-testid="wait-finish">
        Done for now <span lang="zh-Hant-TW">先這樣</span>
      </Button>
    </div>
  );
}
