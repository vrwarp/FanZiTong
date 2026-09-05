import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildClozeExercise } from '@/lib/exercises/cloze';
import { buildFoilExercise } from '@/lib/exercises/foil';
import { buildMenuExercise } from '@/lib/exercises/menu';
import { containsPinyin } from '@/lib/util/pinyin';
import { mulberry32 } from '@/lib/util/random';
import { makePool } from '@/test/factories';
import { ClozeExerciseView } from './ClozeExerciseView';
import { FoilExerciseView } from './FoilExerciseView';
import { MenuExerciseView } from './MenuExerciseView';
import { SessionSummary } from './SessionSummary';

const pool = makePool();

describe('ClozeExerciseView', () => {
  const card = pool.find((c) => c.traditional === '團契')!;
  const exercise = buildClozeExercise(card, pool, mulberry32(1))!;

  it('hides pinyin until an option is picked, then reports the outcome', async () => {
    const onComplete = vi.fn();
    render(<ClozeExerciseView exercise={exercise} card={card} onComplete={onComplete} />);
    expect(containsPinyin(screen.getByTestId('cloze-sentence').textContent ?? '')).toBe(false);
    expect(screen.getByTestId('cloze-feedback').textContent).not.toContain(card.pinyin);
    expect(screen.getAllByTestId('cloze-option')).toHaveLength(4);
    expect(screen.queryByTestId('drill-continue')).not.toBeInTheDocument();
    expect(screen.getByTestId('cloze-blank')).toHaveTextContent('＿＿');

    const wrong = screen.getAllByTestId('cloze-option').find((b) => b.dataset.correct === 'false')!;
    await userEvent.click(wrong);
    expect(screen.getByTestId('cloze-feedback')).toHaveTextContent(card.pinyin);
    expect(screen.getByTestId('cloze-feedback')).toHaveTextContent(/不對/);
    expect(screen.getByTestId('cloze-blank')).toHaveTextContent(wrong.textContent!.trim());
    // Sentence reading stays behind a tap even in feedback; deck-word options get glosses.
    expect(screen.queryByTestId('sentence-pinyin')).not.toBeInTheDocument();
    expect(screen.getByTestId('cloze-glosses').textContent?.length).toBeGreaterThan(0);
    expect(screen.getByTestId('drill-outcome')).toHaveTextContent(/Again/);
    await userEvent.click(screen.getByTestId('drill-continue'));
    expect(onComplete).toHaveBeenCalledWith([{ cardId: card.id, correct: false }]);
  });

  it('marks a correct pick', async () => {
    const onComplete = vi.fn();
    render(<ClozeExerciseView exercise={exercise} card={card} onComplete={onComplete} />);
    const right = screen.getAllByTestId('cloze-option').find((b) => b.dataset.correct === 'true')!;
    await userEvent.click(right);
    expect(screen.getByTestId('cloze-feedback')).toHaveTextContent(/Correct/);
    expect(screen.getByTestId('drill-outcome')).toHaveTextContent(/Good/);
    await userEvent.click(screen.getByTestId('drill-continue'));
    expect(onComplete).toHaveBeenCalledWith([{ cardId: card.id, correct: true }]);
  });
});

describe('FoilExerciseView', () => {
  const card = pool[0];
  const exercise = buildFoilExercise(card, pool, mulberry32(2))!;

  it('uses pinyin + meaning as the cue and grades the chosen shape', async () => {
    const onComplete = vi.fn();
    render(<FoilExerciseView exercise={exercise} card={card} onComplete={onComplete} />);
    expect(screen.getByTestId('foil-cue')).toHaveTextContent(card.pinyin);
    const options = screen.getAllByTestId('foil-option');
    expect(options).toHaveLength(4);
    expect(options.filter((o) => o.dataset.correct === 'true')).toHaveLength(1);
    await userEvent.click(options.find((o) => o.dataset.correct === 'true')!);
    expect(screen.getByTestId('foil-feedback')).toHaveTextContent(/Correct/);
    await userEvent.click(screen.getByTestId('drill-continue'));
    expect(onComplete).toHaveBeenCalledWith([{ cardId: card.id, correct: true }]);
  });

  it('explains a wrong pick character by character and requires one corrective tap', async () => {
    const onComplete = vi.fn();
    render(<FoilExerciseView exercise={exercise} card={card} onComplete={onComplete} />);
    const options = screen.getAllByTestId('foil-option');
    const wrong = options.find(
      (o) => o.dataset.correct === 'false' && o.textContent?.length === card.traditional.length,
    )!;
    await userEvent.click(wrong);
    expect(screen.getByTestId('foil-feedback')).toHaveTextContent(/不對/);
    expect(screen.getByTestId('foil-diff')).toHaveTextContent(/is not/);
    expect(screen.getByTestId('foil-confirm-hint')).toHaveTextContent(card.traditional);
    expect(screen.queryByTestId('drill-continue')).not.toBeInTheDocument();
    await userEvent.click(options.find((o) => o.dataset.correct === 'true')!);
    expect(screen.getByTestId('drill-outcome')).toHaveTextContent(/Again/);
    await userEvent.click(screen.getByTestId('drill-continue'));
    expect(onComplete).toHaveBeenCalledWith([{ cardId: card.id, correct: false }]);
  });
});

describe('MenuExerciseView', () => {
  const food = pool.filter((c) => c.domain === 'food');
  const exercise = buildMenuExercise(food, mulberry32(3))!;

  it('renders the slip, grades ticked boxes and reports per-card outcomes', async () => {
    const onComplete = vi.fn();
    render(<MenuExerciseView exercise={exercise} onComplete={onComplete} />);
    // The order is cued by sound + meaning; the dishes' characters are never in the cue.
    const cue = screen.getByTestId('menu-prompt').textContent ?? '';
    expect(containsPinyin(cue)).toBe(true);
    for (const t of exercise.targets) expect(cue).not.toContain(t.standard);
    expect(screen.getByTestId('menu-slip')).toBeInTheDocument();
    expect(screen.getByTestId('menu-slip')).toHaveTextContent(exercise.shop.name);
    for (const target of exercise.targets) {
      await userEvent.click(document.querySelector(`[data-key="${target.key}"]`)!);
    }
    await userEvent.click(screen.getByTestId('menu-submit'));
    expect(screen.getByTestId('menu-feedback')).toHaveTextContent(/Perfect order/);
    expect(screen.getByTestId('menu-order-hanzi')).toHaveTextContent(exercise.targets[0].standard);
    await userEvent.click(screen.getByTestId('drill-continue'));
    expect(onComplete).toHaveBeenCalledWith(
      exercise.targets.map((t) => ({ cardId: t.cardId, correct: true })),
    );
  });

  it('auto-grades when the 20-second window expires', () => {
    vi.useFakeTimers();
    try {
      render(<MenuExerciseView exercise={exercise} onComplete={vi.fn()} timeLimitMs={1000} />);
      expect(screen.getByTestId('menu-submit')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1200));
      expect(screen.getByTestId('menu-feedback')).toHaveTextContent(/Time's up/);
      expect(screen.getByTestId('drill-continue')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SessionSummary', () => {
  it('shows counts, retention, time and streak', async () => {
    const onDone = vi.fn();
    render(
      <SessionSummary
        mode="complete"
        results={[
          {
            cardId: 'a',
            rating: 1,
            exerciseType: 'rapid_recognition',
            timeMs: 1,
            timestamp: 't',
            applied: true,
          },
          {
            cardId: 'a',
            rating: 3,
            exerciseType: 'rapid_recognition',
            timeMs: 1,
            timestamp: 't',
            applied: true,
          },
          {
            cardId: 'b',
            rating: 4,
            exerciseType: 'cloze',
            timeMs: 1,
            timestamp: 't',
            applied: true,
          },
        ]}
        elapsedMs={14 * 60_000}
        streak={12}
        onDone={onDone}
      />,
    );
    expect(screen.getByTestId('summary-cards')).toHaveTextContent('2');
    expect(screen.getByTestId('summary-answers')).toHaveTextContent('3');
    expect(screen.getByTestId('summary-retention')).toHaveTextContent('1/2');
    expect(screen.getByTestId('summary-time')).toHaveTextContent('14m 00s');
    expect(screen.getByTestId('summary-streak')).toHaveTextContent('Day 12');
    await userEvent.click(screen.getByTestId('summary-done'));
    expect(onDone).toHaveBeenCalled();
  });
});
