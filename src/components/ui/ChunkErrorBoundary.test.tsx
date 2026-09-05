import { render, screen } from '@testing-library/react';
import { clearChunkReloadAttempt, markChunkReloadAttempted } from '@/lib/pwa/chunkErrors';
import { ChunkErrorBoundary } from './ChunkErrorBoundary';

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

const STALE = 'Failed to fetch dynamically imported module: /assets/StatsPage-a1b2.js';

describe('ChunkErrorBoundary', () => {
  beforeEach(() => {
    clearChunkReloadAttempt();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders its children when nothing throws', () => {
    render(
      <ChunkErrorBoundary reload={vi.fn()}>
        <p>study screen</p>
      </ChunkErrorBoundary>,
    );
    expect(screen.getByText('study screen')).toBeInTheDocument();
  });

  it('reloads once onto the new build when a route chunk has gone', () => {
    const reload = vi.fn();
    render(
      <ChunkErrorBoundary reload={reload}>
        <Boom message={STALE} />
      </ChunkErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    // Nothing is shown while the reload is on its way, rather than a flash of error.
    expect(screen.queryByTestId('chunk-error')).not.toBeInTheDocument();
  });

  it('explains the stale tab instead of looping when the reload did not help', () => {
    markChunkReloadAttempted();
    const reload = vi.fn();
    render(
      <ChunkErrorBoundary reload={reload}>
        <Boom message={STALE} />
      </ChunkErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByTestId('chunk-error')).toHaveTextContent('running an old version');
    expect(screen.getByTestId('chunk-error')).toHaveTextContent('progress are saved');
  });

  it('never reloads for an ordinary application error', () => {
    const reload = vi.fn();
    render(
      <ChunkErrorBoundary reload={reload}>
        <Boom message="card.fsrs is not an object" />
      </ChunkErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByTestId('chunk-error')).toHaveTextContent('Something went wrong');
  });
});
