import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { inputClass } from '@/components/ui/Field';
import { CardListItem } from '@/components/vocab/CardListItem';
import { ImportDialog, type ImportSource } from '@/components/vocab/ImportDialog';
import {
  buildStarterDeck,
  planStarterRestore,
  starterRestoreLabel,
  starterRestoreNotice,
  type StarterRestorePlan,
} from '@/data/starterDeck';
import type { VocabCard } from '@/types';
import { repository } from '@/db/repository';
import { useCards, useReviewLogsOrEmpty } from '@/hooks/useCards';
import { useNow } from '@/hooks/useNow';
import { useSettings } from '@/hooks/useSettings';
import { toCsv } from '@/lib/io/csv';
import { downloadTextFile, timestampForFilename } from '@/lib/io/download';
import { serializeJsonDeck, toJsonDeck } from '@/lib/io/json';
import { cn } from '@/lib/util/cn';
import { DOMAIN_CATEGORIES, DOMAIN_LABELS, type DomainCategory } from '@/types';

type DomainFilter = DomainCategory | 'all';
type SortKey = 'study' | 'newest' | 'due';

const DOMAIN_ORDER: DomainCategory[] = ['food', 'church', 'slang', 'anime', 'custom'];

export default function VocabPage() {
  const navigate = useNavigate();
  const cards = useCards();
  const logs = useReviewLogsOrEmpty();
  const { settings } = useSettings();
  const now = useNow();
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<DomainFilter>('all');
  const [showPinyin, setShowPinyin] = useState(false);
  const [sort, setSort] = useState<SortKey>('due');
  const [importSource, setImportSource] = useState<ImportSource | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!cards) return [];
    const q = query.trim().toLowerCase();
    return cards
      .filter((c) => domain === 'all' || c.domain === domain)
      .filter(
        (c) =>
          !q ||
          c.traditional.includes(q) ||
          (c.variants ?? []).some((v) => v.includes(q)) ||
          c.pinyin.toLowerCase().includes(q) ||
          c.definition.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        if (sort === 'newest') return b.createdAt.localeCompare(a.createdAt);
        if (sort === 'due') {
          const dueA = a.fsrs.state === 0 ? Infinity : new Date(a.fsrs.due).getTime();
          const dueB = b.fsrs.state === 0 ? Infinity : new Date(b.fsrs.due).getTime();
          return dueA - dueB || a.createdAt.localeCompare(b.createdAt);
        }
        return (
          DOMAIN_ORDER.indexOf(a.domain) - DOMAIN_ORDER.indexOf(b.domain) ||
          a.createdAt.localeCompare(b.createdAt)
        );
      });
  }, [cards, query, domain, sort]);

  // The starter rows are a separate chunk now, so they are fetched once and
  // kept: this page needs a count while it renders and the whole deck only if
  // the learner asks to restore it.
  const [starter, setStarter] = useState<VocabCard[] | null>(null);
  const [starterError, setStarterError] = useState<string | null>(null);
  const [starterAttempt, setStarterAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void buildStarterDeck().then(
      (deck) => {
        if (!cancelled) setStarter(deck);
      },
      (err: unknown) => {
        // A chunk is a fetch, and a fetch can fail. Saying so beats a control
        // that sits there greyed out for reasons it keeps to itself.
        if (!cancelled) setStarterError((err as Error).message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [starterAttempt]);

  // null until both the deck and the starter rows are here: "not known yet" is
  // not "nothing to do", and the button must not claim otherwise.
  const restorePlan = useMemo(
    () => (cards && starter ? planStarterRestore(cards, starter) : null),
    [cards, starter],
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setImportSource({ fileName: file.name, text });
    if (fileInput.current) fileInput.current.value = '';
  };

  const exportJson = () => {
    if (!cards) return;
    const deck = toJsonDeck(cards, { deckName: 'FanZiTong deck', reviewLogs: logs, settings });
    downloadTextFile(
      `fanzitong-deck-${timestampForFilename()}.json`,
      serializeJsonDeck(deck),
      'application/json',
    );
  };
  const exportCsv = () => {
    if (!cards) return;
    downloadTextFile(`fanzitong-deck-${timestampForFilename()}.csv`, toCsv(cards), 'text/csv');
  };

  const applyRestore = async (plan: StarterRestorePlan) => {
    setConfirmRestore(false);
    // One transaction: the added cards carry fresh ids and the repaired ones
    // carry the ids they already had, so this writes both without touching
    // anything the starter deck does not own.
    const write = [...plan.add, ...plan.repair];
    if (write.length > 0) await repository.importCards(write);
    setNotice(starterRestoreNotice(plan));
  };

  const loadStarter = async () => {
    // The empty-state button can be tapped before the chunk has landed, so the
    // plan is computed on demand rather than assumed to be here.
    const plan = restorePlan ?? planStarterRestore(cards ?? [], await buildStarterDeck());
    // Putting an edited card back the way it ships is the destructive half of
    // this, so it is the half that asks first.
    if (plan.repair.length > 0) setConfirmRestore(true);
    else await applyRestore(plan);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Vocab"
        zh="詞彙"
        subtitle={cards ? `${cards.length} cards` : 'Loading…'}
        action={
          <Button onClick={() => navigate('/vocab/new')} data-testid="add-card">
            + Add
          </Button>
        }
      />

      {notice && (
        <p
          role="status"
          className="rounded-lg bg-jade-500/10 px-3 py-2 text-sm text-jade-600"
          data-testid="vocab-notice"
        >
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <input
          type="search"
          className={inputClass}
          placeholder="Search characters, pinyin, meaning, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search vocabulary"
          data-testid="vocab-search"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${inputClass} min-h-9 w-auto py-0 text-sm`}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort"
            data-testid="vocab-sort"
          >
            <option value="due">Due soonest</option>
            <option value="study">Study order</option>
            <option value="newest">Newest</option>
          </select>
          {(['all', ...DOMAIN_CATEGORIES] as DomainFilter[]).map((d) => (
            <button
              key={d}
              data-testid={`filter-${d}`}
              type="button"
              onClick={() => setDomain(d)}
              className={cn(
                'min-h-9 rounded-full px-3 text-sm font-semibold',
                domain === d
                  ? 'bg-brand-600 text-white'
                  : 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200',
              )}
              aria-pressed={domain === d}
            >
              {d === 'all' ? 'All' : `${DOMAIN_LABELS[d].emoji} ${DOMAIN_LABELS[d].en}`}
            </button>
          ))}
          <label className="ml-auto flex min-h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showPinyin}
              onChange={(e) => setShowPinyin(e.target.checked)}
              data-testid="toggle-pinyin"
            />
            Show pinyin
          </label>
        </div>
      </div>

      <details className="card-surface px-4 py-3" data-testid="vocab-data">
        <summary className="min-h-9 cursor-pointer text-sm font-semibold">
          Import / export / starter deck
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="sr-only"
            aria-label="Import CSV or JSON file"
            data-testid="import-file"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
            data-testid="import-button"
          >
            ⬆️ Import CSV / JSON
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson} data-testid="export-json">
            ⬇️ Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} data-testid="export-csv">
            ⬇️ Export CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadStarter()}
            disabled={!cards || Boolean(starterError)}
            data-testid="load-starter"
          >
            {starterRestoreLabel(restorePlan)}
          </Button>
        </div>
        {starterError && (
          <p className="mt-2 text-xs text-red-700 dark:text-red-400" data-testid="starter-error">
            The starter deck could not be loaded ({starterError}).{' '}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setStarterError(null);
                setStarterAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          </p>
        )}
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          Restoring adds any starter words you are missing and puts edited ones back the way they
          ship, keeping your review history. Full backups live in Settings › Data.
        </p>
      </details>

      {cards && cards.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="Your deck is empty"
          description="Import a CSV/JSON file or load the starter deck to begin."
          action={<Button onClick={loadStarter}>Load starter deck</Button>}
        />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="vocab-list">
          {filtered.map((card) => (
            <CardListItem
              key={card.id}
              card={card}
              showPinyin={showPinyin}
              now={now}
              leechThreshold={settings.leechThreshold}
            />
          ))}
          {filtered.length === 0 && cards && (
            <li className="py-6 text-center text-sm text-stone-500">No cards match.</li>
          )}
        </ul>
      )}

      <Modal
        open={confirmRestore}
        title="Restore the starter deck?"
        onClose={() => setConfirmRestore(false)}
        testId="starter-restore-dialog"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRestore(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (restorePlan) void applyRestore(restorePlan);
              }}
              data-testid="confirm-starter-restore"
            >
              Restore
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {restorePlan?.repair.length} of your cards differ from the version that ships with the
          app, either because you edited them or because a later release corrected them. Restoring
          puts their words, sentences and look-alikes back as shipped. Your review history and
          scheduling are kept.
          {restorePlan && restorePlan.add.length > 0
            ? ` ${restorePlan.add.length} missing card${restorePlan.add.length === 1 ? '' : 's'} will also be added.`
            : ''}
        </p>
      </Modal>

      <ImportDialog
        source={importSource}
        existing={cards ?? []}
        onClose={() => setImportSource(null)}
        onImported={(s) => {
          setImportSource(null);
          setNotice(
            `Imported ${s.inserted} new, updated ${s.updated}, skipped ${s.skipped}${s.logs ? `, restored ${s.logs} review logs` : ''}.`,
          );
        }}
      />
    </div>
  );
}
