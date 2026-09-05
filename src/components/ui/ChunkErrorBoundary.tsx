import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import {
  canAttemptChunkReload,
  isChunkLoadError,
  markChunkReloadAttempted,
} from '@/lib/pwa/chunkErrors';

export interface ChunkErrorBoundaryProps {
  children: ReactNode;
  /** Injected so the recovery path is testable without navigating jsdom. */
  reload?: () => void;
}

interface State {
  error: Error | null;
  /** A reload is already on its way; render nothing rather than flash an error. */
  recovering: boolean;
}

/**
 * Catches the failure a service-worker update causes in a tab that was already
 * open: the new worker drops the old precache, so a route chunk the running
 * page still points at no longer exists and its import rejects.
 *
 * The cure is simply to load the new build, which is done once per tab — a
 * loop would be worse than the error. If that reload did not help, the learner
 * gets an honest screen instead of a blank one.
 */
export class ChunkErrorBoundary extends Component<ChunkErrorBoundaryProps, State> {
  override state: State = { error: null, recovering: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    if (!isChunkLoadError(error) || !canAttemptChunkReload()) return;
    markChunkReloadAttempted();
    this.setState({ recovering: true });
    (this.props.reload ?? (() => window.location.reload()))();
  }

  override render(): ReactNode {
    const { error, recovering } = this.state;
    if (!error || recovering) return recovering ? null : this.props.children;

    const stale = isChunkLoadError(error);
    return (
      <div
        className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center"
        data-testid="chunk-error"
      >
        <p className="text-4xl" aria-hidden>
          🔄
        </p>
        <h1 className="text-xl font-bold">
          {stale ? 'This tab is running an old version' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-300">
          {stale
            ? 'The app updated while this tab was open. Reload to pick up the new version — your deck and progress are saved on this device.'
            : 'Reloading usually clears this. Your deck and progress are saved on this device.'}
        </p>
        <Button
          onClick={this.props.reload ?? (() => window.location.reload())}
          data-testid="chunk-error-reload"
        >
          Reload
        </Button>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Still stuck? Settings › About has “Reset app cache”, which reinstalls the app without
          touching your words.
        </p>
      </div>
    );
  }
}
