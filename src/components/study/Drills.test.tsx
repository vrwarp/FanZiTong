import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildClozeExercise } from '@/lib/exercises/cloze';
import { buildFoilExercise } from '@/lib/exercises/foil';
import { buildMeaningExercise } from '@/lib/exercises/meaning';
import { buildMenuExercise } from '@/lib/exercises/menu';
import { containsPinyin } from '@/lib/util/pinyin';
import { mulberry32 } from '@/lib/util/random';
import { makePool } from '@/test/factories';
import { ClozeExerciseView } from './ClozeExerciseView';
import { FoilExerciseView } from './FoilExerciseView';
import { MeaningExerciseView } from './MeaningExerciseView';
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

    // A real deck word that does not fit is a misreading of the sentence, not of
    // the target: it is explained, and the learner picks again.
    const options = screen.getAllByTestId('cloze-option');
    const misread = options.find(
      (b) => b.dataset.correct === 'false' && b.dataset.foil === 'false',
    )!;
    expect(misread).toBeDefined();
    const misreadWord = misread.textContent!.trim();
    await userEvent.click(misread);
    expect(screen.getByTestId('cloze-misread')).toHaveTextContent(misreadWord);
    expect(screen.queryByTestId('drill-outcome')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drill-continue')).not.toBeInTheDocument();

    // The look-alike foil is a miss on the target itself: contrast, then find it again.
    const foil = options.find((b) => b.dataset.foil === 'true')!;
    const foilText = foil.textContent!.trim();
    await userEvent.click(foil);
    expect(screen.getByTestId('cloze-feedback')).toHaveTextContent(/不對/);
    expect(screen.getByTestId('cloze-diff')).toHaveTextContent(/is not/);
    expect(screen.getByTestId('cloze-blank')).toHaveTextContent(foilText);
    expect(screen.queryByTestId('drill-continue')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('cloze-retry'));
    expect(screen.getByTestId('cloze-retry-hint')).toBeInTheDocument();
    const reshuffled = screen.getAllByTestId('cloze-option');
    await userEvent.click(reshuffled.find((b) => b.dataset.correct === 'true')!);
    expect(screen.getByTestId('cloze-feedback')).toHaveTextContent(card.pinyin);
    // Sentence reading stays behind a tap even in feedback; deck-word options get glosses.
    expect(screen.queryByTestId('sentence-pinyin')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('cloze-gloss').length).toBeGreaterThan(0);
    expect(screen.getByTestId('drill-outcome')).toHaveTextContent(/Again/);
    await userEvent.click(screen.getByTestId('drill-continue'));
    // The report carries what was picked: the look-alike, and both wrong taps.
    expect(onComplete).toHaveBeenCalledWith([
      { cardId: card.id, correct: false, applyRating: true, misses: 2, picked: foilText },
    ]);
  });

  it('marks a correct pick', async () => {
    const onComplete = vi.fn();
    render(<ClozeExerciseView exercise={exercise} card={card} onComplete={onComplete} />);
    const right = screen.getAllByTestId('cloze-option').find((b) => b.dataset.correct === 'true')!;
    await userEvent.click(right);
    expect(screen.getByTestId('cloze-feedback')).toHaveTextContent(/Correct/);
    expect(screen.getByTestId('drill-outcome')).toHaveTextContent(/Good/);
    await userEvent.click(screen.getByTestId('drill-continue'));
    expect(onComplete).toHaveBeenCalledWith([
      { cardId: card.id, correct: true, applyRating: true, misses: 0 },
    ]);
  });

  it('leaves the schedule alone when the right word follows a misread', async () => {
    const onComplete = vi.fn();
    render(<ClozeExerciseView exercise={exercise} card={card} onComplete={onComplete} />);
    const options = screen.getAllByTestId('cloze-option');
    const misread = options.find(
      (b) => b.dataset.correct === 'false' && b.dataset.foil === 'false',
    )!;
    const misreadWord = misread.textContent!.trim();
    await userEvent.click(misread);
    await userEvent.click(options.find((b) => b.dataset.correct === 'true')!);
    expect(screen.getByTestId('cloze-feedback')).toHaveTextContent(/Found it/);
    expect(screen.getByTestId('drill-outcome')).toHaveTextContent(/No change/);
    await userEvent.click(screen.getByTestId('drill-continue'));
    expect(onComplete).toHaveBeenCalledWith([
      { cardId: card.id, correct: true, applyRating: false, misses: 1, picked: misreadWord },
    ]);
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
    // Sets are sized by what the card can honestly support: three balanced
    // tiles when only two alternatives exist, four when two positions cross.
    expect(options).toHaveLength(exercise.options.length);
    expect(options.filter((o) => o.dataset.correct === 'true')).toHaveLength(1);
    await userEvent.click(options.find((o) => o.dataset.correct === 'true')!);
    expect(screen.getByTestId('foil-feedback')).toHaveTextContent(/Correct/);
    await userEvent.click(screen.getByTestId('drill-continue'));
    expect(onComplete).toHaveBeenCalledWith([{ cardId: card.id, correct: true, misses: 0 }]);
  });

  it('gives an odd tile the full width instead of leaving a hole beside it', () => {
    // 滷肉飯 has two alternatives at one position, so the honest set is three.
    render(<FoilExerciseView exercise={exercise} card={card} onComplete={vi.fn()} />);
    const options = screen.getAllByTestId('foil-option');
    expect(options).toHaveLength(3);
    expect(options[2].className).toContain('col-span-2');
    expect(options[0].className).not.toContain('col-span-2');
  });

  it('tells the learner which confusion is on screen', () => {
    render(<FoilExerciseView exercise={exercise} card={card} onComplete={vi.fn()} />);
    const hint = exercise.source === 'homophone' ? /sounds the same/i : /not the silhouette/i;
    expect(screen.getByTestId('foil-feedback')).toHaveTextContent(hint);
  });

  it('explains a wrong pick character by character and requires one corrective tap', async () => {
    const onComplete = vi.fn();
    render(<FoilExerciseView exercise={exercise} card={card} onComplete={onComplete} />);
    const options = screen.getAllByTestId('foil-option');
    const wrong = options.find(
      (o) => o.dataset.correct === 'false' && o.textContent?.length === card.traditional.length,
    )!;
    const wrongText = wrong.textContent!.trim();
    await userEvent.click(wrong);
    expect(screen.getByTestId('foil-feedback')).toHaveTextContent(/不對/);
    expect(screen.getByTestId('foil-diff')).toHaveTextContent(/is not/);
    expect(screen.queryByTestId('drill-continue')).not.toBeInTheDocument();
    // The contrast is studied, then the same word is found again among reshuffled tiles.
    await userEvent.click(screen.getByTestId('foil-retry'));
    expect(screen.getByTestId('foil-retry-hint')).toHaveTextContent(card.pinyin);
    const reshuffled = screen.getAllByTestId('foil-option');
    expect(reshuffled.filter((o) => o.dataset.correct === 'true')).toHaveLength(1);
    await userEvent.click(reshuffled.find((o) => o.dataset.correct === 'true')!);
    expect(screen.getByTestId('drill-outcome')).toHaveTextContent(/Again/);
    await userEvent.click(screen.getByTestId('drill-continue'));
    expect(onComplete).toHaveBeenCalledWith([
      { cardId: card.id, correct: false, misses: 1, picked: wrongText },
    ]);
  });
});

describe('MeaningExerciseView', () => {
  const now = new Date('2026-09-13T08:00:00.000Z');
  const soups = [
    ...pool,
    {
      ...pool[0],
      id: 'yu',
      traditional: '魚丸湯',
      pinyin: 'yú wán tāng',
      definition: 'Fish ball soup',
    },
    {
      ...pool[0],
      id: 'hun',
      traditional: '餛飩湯',
      pinyin: 'hún tun tāng',
      definition: 'Wonton soup',
    },
  ];
  const card = soups.find((c) => c.traditional === '貢丸湯')!;
  const withEar = buildMeaningExercise(card, soups, mulberry32(1), { now, askByEar: true })!;
  const noEar = buildMeaningExercise(card, soups, mulberry32(1), { now, askByEar: false })!;

  it('asks by ear first, explains a wrong reading, then grades the written word like a cloze', async () => {
    const onComplete = vi.fn();
    render(<MeaningExerciseView exercise={withEar} card={card} onComplete={onComplete} />);
    // The cue is the meaning alone: no reading, no characters, no options yet.
    expect(screen.getByTestId('meaning-cue')).toHaveTextContent(card.definition);
    // The cue is English, so "no pinyin" here means no tone-marked reading.
    expect(screen.getByTestId('meaning-cue').textContent).not.toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔù]/);
    expect(screen.getByTestId('meaning-cue').textContent).not.toContain(card.traditional);
    expect(screen.queryAllByTestId('meaning-option')).toHaveLength(0);
    const readings = screen.getAllByTestId('meaning-reading');
    expect(readings).toHaveLength(4);
    expect(readings.filter((r) => r.dataset.correct === 'true')).toHaveLength(1);
    const wrongReading = readings.find((r) => r.dataset.correct === 'false')!;
    await userEvent.click(wrongReading);
    expect(screen.getByTestId('meaning-ear')).toHaveTextContent(/New to your ear/);
    expect(screen.getByTestId('meaning-ear')).toHaveTextContent(card.pinyin);
    expect(screen.queryAllByTestId('meaning-reading')).toHaveLength(0);

    const options = screen.getAllByTestId('meaning-option');
    expect(options).toHaveLength(4);
    expect(options.every((o) => !containsPinyin(o.textContent ?? ''))).toBe(true);
    // A real word that is not this one is a misreading of that word: explained and retired.
    const misread = options.find(
      (o) => o.dataset.correct === 'false' && o.dataset.foil === 'false',
    )!;
    const misreadWord = misread.textContent!.trim();
    await userEvent.click(misread);
    expect(screen.getByTestId('meaning-misread')).toHaveTextContent(misreadWord);
    expect(screen.queryByTestId('drill-continue')).not.toBeInTheDocument();
    // The misspelling is a miss on the target: contrast, then find it again.
    const foil = options.find((o) => o.dataset.foil === 'true')!;
    const foilText = foil.textContent!.trim();
    await userEvent.click(foil);
    expect(screen.getByTestId('meaning-feedback')).toHaveTextContent(/不對/);
    expect(screen.getByTestId('meaning-diff')).toHaveTextContent(/is not/);
    await userEvent.click(screen.getByTestId('meaning-retry'));
    expect(screen.getByTestId('meaning-retry-hint')).toBeInTheDocument();
    const reshuffled = screen.getAllByTestId('meaning-option');
    await userEvent.click(reshuffled.find((o) => o.dataset.correct === 'true')!);
    expect(screen.getByTestId('meaning-feedback')).toHaveTextContent(/Found it/);
    expect(screen.getByTestId('meaning-feedback')).toHaveTextContent(card.pinyin);
    expect(screen.getByTestId('drill-outcome')).toHaveTextContent(/Again/);
    await userEvent.click(screen.getByTestId('drill-continue'));
    expect(onComplete).toHaveBeenCalledWith([
      {
        cardId: card.id,
        correct: false,
        applyRating: true,
        misses: 2,
        picked: foilText,
        heard: false,
      },
    ]);
  });

  it('skips the ear check when it is not due and marks a first-try pick correct', async () => {
    const onComplete = vi.fn();
    render(<MeaningExerciseView exercise={noEar} card={card} onComplete={onComplete} />);
    expect(screen.queryAllByTestId('meaning-reading')).toHaveLength(0);
    const right = screen
      .getAllByTestId('meaning-option')
      .find((o) => o.dataset.correct === 'true')!;
    await userEvent.click(right);
    expect(screen.getByTestId('meaning-feedback')).toHaveTextContent(/Correct/);
    expect(screen.getByTestId('drill-outcome')).toHaveTextContent(/Good/);
    await userEvent.click(screen.getByTestId('drill-continue'));
    expect(onComplete).toHaveBeenCalledWith([
      { cardId: card.id, correct: true, applyRating: true, misses: 0 },
    ]);
  });

  it('leaves the schedule alone when the word follows a misread, and reports the ear check', async () => {
    const onComplete = vi.fn();
    render(<MeaningExerciseView exercise={withEar} card={card} onComplete={onComplete} />);
    await userEvent.click(
      screen.getAllByTestId('meaning-reading').find((r) => r.dataset.correct === 'true')!,
    );
    expect(screen.getByTestId('meaning-ear')).toHaveTextContent(/By ear: yes/);
    const options = screen.getAllByTestId('meaning-option');
    const misread = options.find(
      (o) => o.dataset.correct === 'false' && o.dataset.foil === 'false',
    )!;
    const misreadWord = misread.textContent!.trim();
    await userEvent.click(misread);
    await userEvent.click(options.find((o) => o.dataset.correct === 'true')!);
    expect(screen.getByTestId('drill-outcome')).toHaveTextContent(/No change/);
    // Glosses of the other words stay behind a tap.
    expect(screen.getAllByTestId('meaning-gloss')[0]).toHaveTextContent('tap to check');
    await userEvent.click(screen.getByTestId('drill-continue'));
    expect(onComplete).toHaveBeenCalledWith([
      {
        cardId: card.id,
        correct: true,
        applyRating: false,
        misses: 1,
        picked: misreadWord,
        heard: true,
      },
    ]);
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
    expect(screen.getByTestId('summary-time')).toHaveTextContent('14 min');
    expect(screen.getByTestId('summary-streak')).toHaveTextContent('Day 12');
    await userEvent.click(screen.getByTestId('summary-done'));
    expect(onDone).toHaveBeenCalled();
  });
});
