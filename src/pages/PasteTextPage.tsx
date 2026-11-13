import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { inputClass } from '@/components/ui/Field';
import { Hanzi } from '@/components/ui/Hanzi';
import { repository } from '@/db/repository';
import { useCardsOrEmpty } from '@/hooks/useCards';
import { scanText } from '@/lib/reading/coverage';

/**
 * Paste a text 貼上文字: a family message, the Sunday bulletin, a menu. The
 * deck's words in it that the learner has not met are found and can be asked
 * for next, ahead of the deck's own order — the nearest the deck comes to
 * holding words from the learner's own week.
 */
export default function PasteTextPage() {
  const navigate = useNavigate();
  const cards = useCardsOrEmpty();
  const [text, setText] = useState('');
  const [queued, setQueued] = useState<number | null>(null);
  const scan = useMemo(() => (text.trim() ? scanText(text, cards) : null), [text, cards]);
  const waiting = scan?.unseen.filter((c) => !c.queuedAt) ?? [];

  const queue = async () => {
    if (!scan) return;
    const base = Date.now();
    // In order of appearance: the stamp is what the queue sorts by.
    await repository.putCards(
      waiting.map((card, i) => {
        const at = new Date(base + i).toISOString();
        return { ...card, queuedAt: at, updatedAt: at };
      }),
    );
    setQueued(waiting.length);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Paste a text"
        zh="貼上文字"
        subtitle="A message, a bulletin, a menu. The deck's words in it come next."
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate('/vocab')}>
            Back
          </Button>
        }
      />
      <textarea
        className={`${inputClass} min-h-40`}
        lang="zh-Hant-TW"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setQueued(null);
        }}
        placeholder="貼上中文…"
        aria-label="Text to scan"
        data-testid="paste-text"
      />
      {scan && (
        <section className="card-surface flex flex-col gap-3 p-4" data-testid="paste-result">
          <p className="text-sm">
            {scan.characters} characters · <b data-testid="paste-studied">{scan.studied.length}</b>{' '}
            deck words you are studying · <b data-testid="paste-unseen">{scan.unseen.length}</b> you
            have not met
          </p>
          {scan.unseen.length > 0 && (
            <>
              <ul className="flex flex-wrap gap-1.5">
                {scan.unseen.map((card) => (
                  <li
                    key={card.id}
                    className="rounded-lg border border-stone-200 px-2 py-1 text-sm dark:border-stone-700"
                  >
                    <Hanzi className="font-semibold">{card.traditional}</Hanzi>{' '}
                    <span className="text-xs text-stone-500 dark:text-stone-400">
                      {card.definition}
                      {card.queuedAt && ' · asked for'}
                    </span>
                  </li>
                ))}
              </ul>
              {queued !== null ? (
                <p className="text-sm font-semibold text-jade-600" data-testid="paste-queued">
                  {queued} {queued === 1 ? 'word comes' : 'words come'} next, ahead of the
                  deck&rsquo;s own order.
                </p>
              ) : (
                waiting.length > 0 && (
                  <Button onClick={() => void queue()} data-testid="paste-queue">
                    Study {waiting.length === 1 ? 'this word' : `these ${waiting.length} words`}{' '}
                    next
                  </Button>
                )
              )}
            </>
          )}
          {scan.uncovered.length > 0 && (
            <p className="text-sm text-stone-600 dark:text-stone-300" data-testid="paste-uncovered">
              Not in any deck word found here:{' '}
              <Hanzi className="font-semibold">
                {scan.uncovered
                  .slice(0, 40)
                  .map((u) => u.char)
                  .join(' ')}
              </Hanzi>
              . A word of your own can be{' '}
              <Link
                to="/vocab/new"
                className="font-semibold text-brand-600 underline dark:text-brand-300"
              >
                added by hand
              </Link>
              .
            </p>
          )}
        </section>
      )}
    </div>
  );
}
