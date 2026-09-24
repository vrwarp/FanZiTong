import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createScheduler, previewRatings } from '@/lib/fsrs/scheduler';
import { containsPinyin } from '@/lib/util/pinyin';
import { loadEtymologyTable } from '@/lib/etymology';
import { makeCard } from '@/test/factories';
import { RecognitionCard } from './RecognitionCard';

// The dictionary line on the reveal comes from the composition chunk.
beforeAll(() => loadEtymologyTable());

const scheduler = createScheduler({ targetRetention: 0.9 }, { enableFuzz: false });

function renderCard(overrides: Partial<React.ComponentProps<typeof RecognitionCard>> = {}) {
  const card = makeCard();
  const onReveal = vi.fn();
  const onRate = vi.fn();
  const previews = previewRatings(scheduler, card.fsrs, new Date());
  const utils = render(
    <RecognitionCard
      card={card}
      pool={[card]}
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
    expect(screen.getByTestId('session-progress')).toHaveTextContent('Card 4 of 23');
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
    expect(screen.getByTestId('interval-1')).toHaveTextContent(/^\d+m$/);
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

describe('RatingButtons in practice mode', () => {
  it('prints no interval on Again and Hard for a word already knocked down today', async () => {
    const { RatingButtons } = await import('./RatingButtons');
    const previews = {
      1: { rating: 1, due: new Date(), intervalLabel: '1m', scheduledDays: 0, state: 1 },
      2: { rating: 2, due: new Date(), intervalLabel: '6m', scheduledDays: 0, state: 1 },
      3: { rating: 3, due: new Date(), intervalLabel: '10m', scheduledDays: 0, state: 1 },
      4: { rating: 4, due: new Date(), intervalLabel: '4d', scheduledDays: 4, state: 2 },
    } as const;
    render(<RatingButtons previews={previews} onRate={() => {}} visible practice />);
    expect(screen.getByTestId('rating-practice')).toHaveTextContent(/a pass still counts/);
    expect(screen.getByTestId('interval-1')).toHaveTextContent('one more look');
    expect(screen.getByTestId('interval-2')).toHaveTextContent('one more look');
    expect(screen.getByTestId('interval-3')).toHaveTextContent('10m');
    expect(screen.getByTestId('interval-4')).toHaveTextContent('4d');
    expect(screen.getByTestId('rate-1').getAttribute('aria-label')).toMatch(/one more look/);
  });
});

describe('RecognitionCard — a new word met face up', () => {
  it('shows the answer from the start, rates nothing, and hands back one "got it"', async () => {
    const onDone = vi.fn();
    const { card, onReveal, onRate } = renderCard({ intro: { onDone } });
    expect(screen.getByTestId('intro-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('new-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('pinyin')).toHaveTextContent(card.pinyin);
    expect(screen.getByTestId('definition')).toHaveTextContent(card.definition);
    expect(screen.getByTestId('example-sentence')).toBeInTheDocument();
    expect(screen.queryByTestId('rating-buttons')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recognition-prompt')).not.toBeInTheDocument();
    expect(screen.getByTestId('intro-note')).toHaveTextContent(/comes back/);
    await userEvent.click(screen.getByTestId('intro-prompt'));
    expect(onReveal).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('intro-done'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onRate).not.toHaveBeenCalled();
  });
});

describe('RecognitionCard — the dictionary’s other senses', () => {
  it('lists the meanings the card does not teach, at most three, once revealed', async () => {
    const card = makeCard({
      traditional: '機車',
      pinyin: 'jī chē',
      definition: 'Annoying, hard to deal with (of a person)',
      domain: 'slang',
      exampleSentenceTraditional: '你不要那麼機車好不好？',
    });
    const previews = previewRatings(scheduler, card.fsrs, new Date());
    render(
      <RecognitionCard
        card={card}
        pool={[card]}
        revealed={true}
        previews={previews}
        onReveal={() => {}}
        onRate={() => {}}
        autoRevealMs={0}
        position={1}
        total={1}
      />,
    );
    const senses = await screen.findByTestId('dictionary-senses');
    expect(senses).toHaveTextContent('Dictionary');
    expect(senses).toHaveTextContent('locomotive');
    expect(senses).toHaveTextContent('motorcycle');
    expect(senses).not.toHaveTextContent('annoying');
    expect(senses.textContent?.split(' · ').length).toBeLessThanOrEqual(3);
  });

  it('stays quiet before the reveal and for a word with nothing to add', () => {
    const { rerender } = renderCard();
    expect(screen.queryByTestId('dictionary-senses')).not.toBeInTheDocument();
    const card = makeCard(); // 滷肉飯: the dictionary sense is the card's own
    rerender(
      <RecognitionCard
        card={card}
        pool={[card]}
        revealed={true}
        previews={null}
        onReveal={() => {}}
        onRate={() => {}}
        autoRevealMs={0}
        position={1}
        total={1}
      />,
    );
    expect(screen.queryByTestId('dictionary-senses')).not.toBeInTheDocument();
  });
});

describe('RecognitionCard — is the Mandarin reading used too?', () => {
  const show = (spokenUse?: 'only' | 'usual' | 'either' | 'also') => {
    const card = makeCard({
      traditional: '蚵仔煎',
      pinyin: 'kē zǎi jiān',
      spoken: 'ô-á-tsian',
      ...(spokenUse ? { spokenUse } : {}),
    });
    return render(
      <RecognitionCard
        card={card}
        pool={[card]}
        revealed={true}
        previews={null}
        onReveal={() => {}}
        onRate={() => {}}
        autoRevealMs={0}
        position={1}
        total={1}
      />,
    );
  };

  it('says when the word is only ever said the Taiwanese way', () => {
    show('only');
    expect(screen.getByTestId('spoken-use')).toHaveTextContent(/Only ever said the Taiwanese way/);
    expect(screen.getByTestId('spoken-use')).toHaveTextContent('nobody says kē zǎi jiān');
    expect(screen.getByTestId('pinyin').textContent).toMatch(/^ô-á-tsian/);
  });

  it('says when either reading is common, and when the Taiwanese one is usual', () => {
    const { unmount } = show('either');
    expect(screen.getByTestId('spoken-use')).toHaveTextContent(/Said either way/);
    unmount();
    show('usual');
    expect(screen.getByTestId('spoken-use')).toHaveTextContent(/Usually said the Taiwanese way/);
  });

  it('puts the pinyin first when Mandarin is the usual way to say it', () => {
    show('also');
    expect(screen.getByTestId('spoken-use')).toHaveTextContent(/Usually said in Mandarin/);
    expect(screen.getByTestId('pinyin').textContent).toMatch(/^kē zǎi jiān/);
    expect(screen.getByTestId('spoken')).toHaveTextContent('ô-á-tsian');
  });

  it('keeps the neutral line for a card with no verdict', () => {
    show();
    expect(screen.getByTestId('spoken-use')).toHaveAttribute('data-use', 'unknown');
    expect(screen.getByTestId('spoken-use')).toHaveTextContent(/Said the Taiwanese way/);
  });
});
