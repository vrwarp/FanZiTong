import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createScheduler, previewRatings } from '@/lib/fsrs/scheduler';
import { containsPinyin } from '@/lib/util/pinyin';
import { makeCard } from '@/test/factories';
import { RecognitionCard } from './RecognitionCard';

const scheduler = createScheduler({ targetRetention: 0.9 }, { enableFuzz: false });

function renderCard(overrides: Partial<React.ComponentProps<typeof RecognitionCard>> = {}) {
  const card = makeCard();
  const onReveal = vi.fn();
  const onRate = vi.fn();
  const previews = previewRatings(scheduler, card.fsrs, new Date());
  const utils = render(
    <RecognitionCard
      card={card}
      revealed={false}
      previews={null}
      onReveal={onReveal}
      onRate={onRate}
      autoRevealMs={0}
      position={4}
      total={23}
      {...overrides}
    />,
  );
  return { card, onReveal, onRate, previews, ...utils };
}

describe('RecognitionCard (AC-2: no pinyin crutch)', () => {
  it('shows only the Traditional characters before the tap', () => {
    const { card } = renderCard();
    expect(screen.getByTestId('prompt-hanzi')).toHaveTextContent(card.traditional);
    expect(screen.queryByTestId('pinyin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('definition')).not.toBeInTheDocument();
    expect(screen.getByTestId('recognition-card').textContent).not.toContain(card.pinyin);
    expect(containsPinyin(screen.getByTestId('prompt-hanzi').textContent ?? '')).toBe(false);
    expect(screen.getByTestId('session-progress')).toHaveTextContent('Card 4/23');
    expect(screen.getByTestId('rating-buttons')).toHaveAttribute('aria-hidden', 'true');
  });

  it('calls onReveal when the prompt is tapped', async () => {
    const { onReveal } = renderCard();
    await userEvent.click(screen.getByTestId('recognition-prompt'));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('shows pinyin, definition, sentence and rating intervals once revealed', async () => {
    const previews = previewRatings(scheduler, makeCard().fsrs, new Date());
    const { card, onRate } = renderCard({ revealed: true, previews });
    expect(screen.getByTestId('pinyin')).toHaveTextContent(card.pinyin);
    expect(screen.getByTestId('definition')).toHaveTextContent(card.definition);
    expect(screen.getByTestId('example-sentence')).toHaveTextContent(
      card.exampleSentenceTraditional!,
    );
    expect(screen.getByTestId('interval-1')).toHaveTextContent('<10m');
    expect(screen.getByTestId('rating-buttons')).not.toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(screen.getByTestId('rate-3'));
    expect(onRate).toHaveBeenCalledWith(3);
  });

  it('auto-reveals after the configured delay, and not before', () => {
    vi.useFakeTimers();
    try {
      const { onReveal } = renderCard({ autoRevealMs: 3000 });
      expect(screen.getByText(/auto-reveals in 3s/)).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(2999));
      expect(onReveal).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(onReveal).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never auto-reveals in manual mode', () => {
    vi.useFakeTimers();
    try {
      const { onReveal } = renderCard({ autoRevealMs: 0 });
      act(() => vi.advanceTimersByTime(60_000));
      expect(onReveal).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
