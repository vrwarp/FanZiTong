import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hanzi } from '@/components/ui/Hanzi';
import { charInfo } from '@/data/charInfo';
import { useCardsOrEmpty } from '@/hooks/useCards';
import { useEtymology } from '@/hooks/useEtymology';
import { useReadingState } from '@/hooks/useReadingState';
import {
  knownCharacters,
  pickReadingSentences,
  sentenceCoverage,
  untestedCharacters,
  type ReadingSentence,
} from '@/lib/reading/coverage';
import { charactersPerMinute, recordCharacterCheck, recordReadingRun } from '@/lib/reading/state';
import { cn } from '@/lib/util/cn';
import { hanChars } from '@/lib/util/pinyin';

/** Sentences in one reading run. */
const RUN_SENTENCES = 5;
/** Characters on one page of the common-character check. */
const CHECK_PAGE = 20;

type Mode = 'menu' | 'read' | 'check';

/**
 * Reading 讀句子: whole sentences made mostly of words the learner knows,
 * with no reading shown, and one question — which characters could you not
 * read? — and the common-character check, which asks the same of the
 * characters every sentence is glued together with.
 */
export default function ReadPage() {
  const cards = useCardsOrEmpty();
  const { state, save } = useReadingState();
  const [mode, setMode] = useState<Mode>('menu');
  // Character glosses come from the dictionary chunk.
  useEtymology();

  const known = useMemo(
    () => knownCharacters(cards, state.known, state.unknown),
    [cards, state.known, state.unknown],
  );
  const coverage = useMemo(() => sentenceCoverage(cards, known), [cards, known]);
  const answered = useMemo(() => new Set([...state.known, ...state.unknown]), [state]);
  const untested = useMemo(() => untestedCharacters(cards, answered), [cards, answered]);
  const speed = charactersPerMinute(state.runs.slice(-10));
  const studied = cards.filter((c) => c.fsrs.state !== 0).length;

  if (mode === 'read') {
    return (
      <ReadingRunView
        key={state.runs.length}
        sentences={pickReadingSentences(cards, known, {
          count: RUN_SENTENCES,
          avoid: new Set(state.recent),
        })}
        onDone={({ texts, ...run }, tapped) =>
          void save(recordReadingRun(state, run, texts, tapped))
        }
        onExit={() => setMode('menu')}
      />
    );
  }

  if (mode === 'check') {
    return (
      <CharacterCheckView
        key={answered.size}
        characters={untested.slice(0, CHECK_PAGE).map((u) => u.char)}
        remaining={untested.length}
        onDone={(shown, notReadable) => void save(recordCharacterCheck(state, shown, notReadable))}
        onExit={() => setMode('menu')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Read"
        zh="讀句子"
        subtitle="Whole sentences, no reading shown. Tap what you could not read."
      />
      {studied === 0 ? (
        <EmptyState
          icon="📖"
          title="Nothing to read yet"
          description="Study a few words first; the sentences here are built from the words you know."
          action={
            <Link to="/" className="font-semibold text-brand-600 underline dark:text-brand-300">
              Back to Learn
            </Link>
          }
        />
      ) : (
        <>
          <section className="card-surface flex flex-col gap-2 p-4" data-testid="read-summary">
            <p className="text-sm">
              {coverage === null ? (
                'No sentences on your studied words yet.'
              ) : (
                <>
                  You can be taken to read{' '}
                  <b data-testid="read-coverage">{Math.round(coverage * 100)}%</b> of the characters
                  in your own cards&rsquo; sentences.
                </>
              )}
              {speed !== null && (
                <>
                  {' '}
                  Lately: <b data-testid="read-speed">{speed}</b> characters a minute.
                </>
              )}
            </p>
            <Button block size="lg" onClick={() => setMode('read')} data-testid="read-start">
              Read {RUN_SENTENCES} sentences
            </Button>
          </section>

          <section className="card-surface flex flex-col gap-2 p-4" data-testid="check-summary">
            <h2 className="text-lg font-bold">
              Common characters <span lang="zh-Hant-TW">常用字</span>
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-300">
              {untested.length > 0 ? (
                <>
                  <b data-testid="check-remaining">{untested.length}</b> characters appear in the
                  deck&rsquo;s sentences but in no word you have studied — 的, 這, 了 and their
                  kind. Nothing has ever asked whether you can read them. Twenty at a time, most
                  common first.
                </>
              ) : (
                'Every character in the deck’s sentences is accounted for.'
              )}
              {state.unknown.length > 0 && (
                <>
                  {' '}
                  Not readable yet:{' '}
                  <Hanzi className="font-semibold" data-testid="check-unknown">
                    {state.unknown.slice(0, 30).join(' ')}
                  </Hanzi>
                  .
                </>
              )}
            </p>
            {untested.length > 0 && (
              <Button variant="outline" onClick={() => setMode('check')} data-testid="check-start">
                Check the next {Math.min(CHECK_PAGE, untested.length)}
              </Button>
            )}
          </section>
        </>
      )}
    </div>
  );
}

interface FinishedRun {
  at: string;
  sentences: number;
  characters: number;
  tapped: number;
  ms: number;
  texts: string[];
}

function ReadingRunView({
  sentences,
  onDone,
  onExit,
}: {
  sentences: ReadingSentence[];
  onDone: (run: FinishedRun, tapped: string[]) => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [tapped, setTapped] = useState<Set<number>>(new Set());
  const [shown, setShown] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [totals, setTotals] = useState({ ms: 0, characters: 0, tapped: [] as string[] });

  if (sentences.length === 0) {
    return (
      <EmptyState
        icon="📖"
        title="No sentences ready"
        description="None of your words’ sentences is readable enough yet, or you have read them all lately. Try the common-character check, or come back after a few more words."
        action={<Button onClick={onExit}>Back</Button>}
      />
    );
  }

  if (index >= sentences.length) {
    const perMinute = totals.ms > 0 ? Math.round(totals.characters / (totals.ms / 60_000)) : null;
    return (
      <div className="flex flex-col gap-4" data-testid="read-done">
        <PageHeader title="Read" zh="讀句子" />
        <section className="card-surface flex flex-col gap-2 p-4">
          <p className="text-lg font-bold">
            {sentences.length} sentences, {totals.characters} characters
            {perMinute !== null && ` · ${perMinute} a minute`}
          </p>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {totals.tapped.length === 0 ? (
              'Nothing tapped: you read every character.'
            ) : (
              <>
                Could not read:{' '}
                <Hanzi className="font-semibold">
                  {Array.from(new Set(totals.tapped)).join(' ')}
                </Hanzi>
                . They are kept in Stats.
              </>
            )}
          </p>
          <Button block onClick={onExit} data-testid="read-finish">
            Done
          </Button>
        </section>
      </div>
    );
  }

  const sentence = sentences[index];
  const chars = Array.from(sentence.traditional);
  const tappedChars = chars.filter((_, i) => tapped.has(i));

  const reveal = () => {
    setTotals((t) => ({
      ms: t.ms + Math.min(Date.now() - startedAt, 120_000),
      characters: t.characters + hanChars(sentence.traditional).length,
      tapped: [...t.tapped, ...tappedChars],
    }));
    setShown(true);
  };
  const next = () => {
    const last = index + 1 >= sentences.length;
    if (last) {
      onDone(
        {
          at: new Date().toISOString(),
          sentences: sentences.length,
          characters: totals.characters,
          tapped: totals.tapped.length,
          ms: totals.ms,
          texts: sentences.map((s) => s.traditional),
        },
        totals.tapped,
      );
    }
    setIndex(index + 1);
    setTapped(new Set());
    setShown(false);
    setStartedAt(Date.now());
  };

  return (
    <div className="flex flex-col gap-4" data-testid="read-run">
      <PageHeader
        title="Read"
        zh="讀句子"
        subtitle={`Sentence ${index + 1} of ${sentences.length}`}
        action={
          <Button variant="ghost" size="sm" onClick={onExit}>
            Stop
          </Button>
        }
      />
      <section className="card-surface flex flex-col gap-3 p-4">
        <p className="text-xs text-stone-500 dark:text-stone-400">
          {shown
            ? 'Check yourself against the reading.'
            : 'Read it to yourself. Tap any character you could not read, then show the reading.'}
        </p>
        <p className="flex flex-wrap gap-y-1 text-3xl leading-relaxed" data-testid="read-sentence">
          {chars.map((ch, i) => {
            const han = hanChars(ch).length > 0;
            if (!han) return <span key={i}>{ch}</span>;
            return (
              <button
                key={i}
                type="button"
                disabled={shown}
                aria-pressed={tapped.has(i)}
                onClick={() =>
                  setTapped((prev) => {
                    const nextSet = new Set(prev);
                    if (nextSet.has(i)) nextSet.delete(i);
                    else nextSet.add(i);
                    return nextSet;
                  })
                }
                className={cn(
                  'hanzi rounded px-0.5',
                  tapped.has(i) &&
                    'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-50',
                )}
                lang="zh-Hant-TW"
                data-testid="read-char"
              >
                {ch}
              </button>
            );
          })}
        </p>
        {shown && (
          <div className="flex flex-col gap-1 border-t border-stone-200 pt-2 dark:border-stone-700">
            {sentence.pinyin && (
              <p className="text-brand-700 dark:text-brand-300" data-testid="read-pinyin">
                {sentence.pinyin}
              </p>
            )}
            {sentence.translation && <p className="text-sm">{sentence.translation}</p>}
            {tappedChars.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5 text-sm" data-testid="read-tapped">
                {Array.from(new Set(tappedChars)).map((ch) => {
                  const info = charInfo(ch);
                  return (
                    <li key={ch}>
                      <Hanzi className="text-lg font-semibold">{ch}</Hanzi>
                      {info?.pinyin && ` ${info.pinyin}`}
                      {info?.gloss && ` — ${info.gloss}`}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        {shown ? (
          <Button block size="lg" onClick={next} data-testid="read-next">
            {index + 1 >= sentences.length ? 'Finish' : 'Next sentence'}
          </Button>
        ) : (
          <Button block size="lg" onClick={reveal} data-testid="read-show">
            {tapped.size === 0 ? 'I read all of it — show the reading' : 'Show the reading'}
          </Button>
        )}
      </section>
    </div>
  );
}

function CharacterCheckView({
  characters,
  remaining,
  onDone,
  onExit,
}: {
  characters: string[];
  remaining: number;
  onDone: (shown: string[], notReadable: Set<string>) => void;
  onExit: () => void;
}) {
  const [notReadable, setNotReadable] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(false);

  if (characters.length === 0) {
    return (
      <EmptyState
        icon="✅"
        title="All checked"
        description="Every common character has an answer."
        action={<Button onClick={onExit}>Back</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="check-run">
      <PageHeader
        title="Common characters"
        zh="常用字"
        subtitle={`${remaining} left to check`}
        action={
          <Button variant="ghost" size="sm" onClick={onExit}>
            Stop
          </Button>
        }
      />
      <section className="card-surface flex flex-col gap-3 p-4">
        <p className="text-sm text-stone-600 dark:text-stone-300">
          {shown
            ? 'The readings. What you tapped is kept as not readable yet; the rest count as known.'
            : 'Tap every character you can NOT read out loud. Leave the ones you can.'}
        </p>
        <ul className="grid grid-cols-5 gap-2">
          {characters.map((ch) => {
            const info = shown ? charInfo(ch) : undefined;
            const off = notReadable.has(ch);
            return (
              <li key={ch}>
                <button
                  type="button"
                  disabled={shown}
                  aria-pressed={off}
                  onClick={() =>
                    setNotReadable((prev) => {
                      const next = new Set(prev);
                      if (next.has(ch)) next.delete(ch);
                      else next.add(ch);
                      return next;
                    })
                  }
                  className={cn(
                    'flex min-h-16 w-full flex-col items-center justify-center rounded-xl border border-stone-200 dark:border-stone-700',
                    off && 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-50',
                  )}
                  data-testid="check-char"
                >
                  <Hanzi className="text-2xl font-semibold">{ch}</Hanzi>
                  {info?.pinyin && <span className="text-[11px]">{info.pinyin}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {shown ? (
          <Button
            block
            size="lg"
            onClick={() => onDone(characters, notReadable)}
            data-testid="check-save"
          >
            Save and continue
          </Button>
        ) : (
          <Button block size="lg" onClick={() => setShown(true)} data-testid="check-show">
            {notReadable.size === 0 ? 'I can read all of these' : 'Show the readings'}
          </Button>
        )}
      </section>
    </div>
  );
}
