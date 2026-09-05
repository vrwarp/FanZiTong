import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { inputClass } from '@/components/ui/Field';
import { CardListItem } from '@/components/vocab/CardListItem';
import { ImportDialog, type ImportSource } from '@/components/vocab/ImportDialog';
import { buildStarterDeck, STARTER_DECK_NAME } from '@/data/starterDeck';
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

  const missingStarter = useMemo(() => {
    if (!cards) return 0;
    const have = new Set(cards.map((c) => c.traditional));
    return buildStarterDeck().filter((c) => !have.has(c.traditional)).length;
  }, [cards]);

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

  const loadStarter = async () => {
    if (!cards) return;
    const have = new Set(cards.map((c) => c.traditional));
    const missing = buildStarterDeck().filter((c) => !have.has(c.traditional));
    await repository.importCards(missing);
    setNotice(
      `Added ${missing.length} card${missing.length === 1 ? '' : 's'} from “${STARTER_DECK_NAME}”.`,
    );
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
            onClick={loadStarter}
            disabled={missingStarter === 0}
            data-testid="load-starter"
          >
            Restore starter deck{missingStarter > 0 ? ` (adds ${missingStarter})` : ' (complete)'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          Full backups (with review history) live in Settings › Data.
        </p>
      </details>

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
