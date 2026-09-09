import { act, fireEvent, render, screen } from '@testing-library/react';
import { WaitStep } from './WaitStep';

describe('WaitStep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T16:07:46.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down to the next look and hands over when the gap has passed', () => {
    const onReady = vi.fn();
    render(
      <WaitStep until={Date.now() + 42_000} waiting={1} onReady={onReady} onFinish={() => {}} />,
    );
    expect(screen.getByTestId('wait-countdown')).toHaveTextContent('0:42');
    expect(screen.getByTestId('wait-step')).toHaveTextContent(/One word comes back/);
    expect(onReady).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByTestId('wait-countdown')).toHaveTextContent('0:12');
    act(() => {
      vi.advanceTimersByTime(12_500);
    });
    expect(onReady).toHaveBeenCalled();
  });

  it('never shows the waiting word, and offers to stop instead', () => {
    const onFinish = vi.fn();
    render(
      <WaitStep until={Date.now() + 90_000} waiting={2} onReady={() => {}} onFinish={onFinish} />,
    );
    expect(screen.getByTestId('wait-step')).toHaveTextContent(/2 words come back in 1:30/);
    // Nothing about the waiting cards is on screen: not their characters, not a count-per-word.
    expect(screen.queryByTestId('prompt-hanzi')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('wait-finish'));
    expect(onFinish).toHaveBeenCalled();
  });
});
