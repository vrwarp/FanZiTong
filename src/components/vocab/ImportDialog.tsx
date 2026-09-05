import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { inputClass } from '@/components/ui/Field';
import { Hanzi } from '@/components/ui/Hanzi';
import { Modal } from '@/components/ui/Modal';
import { repository } from '@/db/repository';
import { analyzeImport, materializeImport, type DuplicatePolicy } from '@/lib/io/importer';
import { parseImportFile, type ImportSource } from '@/lib/io/parseImportFile';
import { cn } from '@/lib/util/cn';
import { DOMAIN_CATEGORIES, DOMAIN_LABELS, type DomainCategory, type VocabCard } from '@/types';

export type { ImportSource } from '@/lib/io/parseImportFile';

export interface ImportDialogProps {
  source: ImportSource | null;
  existing: VocabCard[];
  onClose: () => void;
  onImported: (summary: {
    inserted: number;
    updated: number;
    skipped: number;
    logs: number;
  }) => void;
}

const PREVIEW_LIMIT = 60;

/** Journey 2: preview, validate, flag duplicates, pick a domain, confirm. */
export function ImportDialog({ source, existing, onClose, onImported }: ImportDialogProps) {
  const [domainOverride, setDomainOverride] = useState<DomainCategory | ''>('');
  const [policy, setPolicy] = useState<DuplicatePolicy>('skip');
  const [restoreHistory, setRestoreHistory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => (source ? parseImportFile(source) : null), [source]);
  const preview = useMemo(
    () => (parsed ? analyzeImport(parsed.rows, existing) : null),
    [parsed, existing],
  );

  const confirm = async () => {
    if (!parsed || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const result = materializeImport(preview, existing, {
        domainOverride: domainOverride || undefined,
        duplicatePolicy: policy,
      });
      const cards = [...result.toInsert, ...result.toUpdate];
      const knownIds = new Set([...existing.map((c) => c.id), ...cards.map((c) => c.id)]);
      const logs = restoreHistory ? parsed.reviewLogs.filter((l) => knownIds.has(l.cardId)) : [];
      await repository.importCards(cards, logs);
      if (restoreHistory && parsed.settings) await repository.saveSettings(parsed.settings);
      onImported({
        inserted: result.toInsert.length,
        updated: result.toUpdate.length,
        skipped: result.skipped,
        logs: logs.length,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const importable = preview
    ? preview.counts.new + (policy === 'overwrite' ? preview.counts.duplicate : 0)
    : 0;

  return (
    <Modal
      open={source !== null}
      title="Import vocabulary"
      onClose={busy ? undefined : onClose}
      testId="import-dialog"
      className="w-[min(96vw,44rem)]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={busy || importable === 0}
            data-testid="import-confirm"
          >
            {busy ? 'Importing…' : `Import ${importable} card${importable === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      {parsed && preview && (
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-stone-600 dark:text-stone-300">
            <strong>{source?.fileName}</strong> · {parsed.kind.toUpperCase()}
            {parsed.deckName && ` · “${parsed.deckName}”`}
          </p>

          <dl className="grid grid-cols-3 gap-2 text-center" data-testid="import-counts">
            <Count label="New" value={preview.counts.new} tone="jade" />
            <Count label="Duplicates" value={preview.counts.duplicate} tone="amber" />
            <Count label="Repeated in file" value={preview.counts.duplicateInFile} tone="stone" />
          </dl>

          {parsed.issues.length > 0 && (
            <ul
              className="max-h-28 overflow-y-auto rounded-lg bg-red-50 p-2 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-200"
              data-testid="import-issues"
            >
              {parsed.issues.map((issue, i) => (
                <li key={i}>
                  {issue.row > 0 ? `Row ${issue.row}: ` : ''}
                  {issue.message}
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-semibold">
              Domain tag
              <select
                className={inputClass}
                value={domainOverride}
                onChange={(e) => setDomainOverride(e.target.value as DomainCategory | '')}
                data-testid="import-domain"
              >
                <option value="">Keep from file (unknown → custom)</option>
                {DOMAIN_CATEGORIES.map((d) => (
                  <option key={d} value={d}>
                    #{d} · {DOMAIN_LABELS[d].zh}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex flex-col gap-1 font-semibold">
              <legend>Duplicates</legend>
              <label className="flex min-h-10 items-center gap-2 font-normal">
                <input
                  type="radio"
                  name="dup"
                  checked={policy === 'skip'}
                  onChange={() => setPolicy('skip')}
                />
                Skip (keep my existing cards)
              </label>
              <label className="flex min-h-10 items-center gap-2 font-normal">
                <input
                  type="radio"
                  name="dup"
                  checked={policy === 'overwrite'}
                  onChange={() => setPolicy('overwrite')}
                  data-testid="import-overwrite"
                />
                Update existing cards from file
              </label>
            </fieldset>
          </div>

          {parsed.kind === 'json' && (parsed.reviewLogs.length > 0 || parsed.settings) && (
            <label className="flex min-h-10 items-center gap-2">
              <input
                type="checkbox"
                checked={restoreHistory}
                onChange={(e) => setRestoreHistory(e.target.checked)}
              />
              Restore review history ({parsed.reviewLogs.length} logs)
              {parsed.settings ? ' and settings' : ''}
            </label>
          )}

          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
            <table className="w-full text-left text-xs" data-testid="import-preview">
              <thead className="bg-stone-100 dark:bg-stone-800">
                <tr>
                  <th className="px-2 py-1.5">Traditional</th>
                  <th className="px-2 py-1.5">Pinyin</th>
                  <th className="px-2 py-1.5">Definition</th>
                  <th className="px-2 py-1.5">Domain</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, PREVIEW_LIMIT).map((row) => (
                  <tr
                    key={`${row.row.sourceIndex}-${row.row.traditional}`}
                    className={cn(
                      'border-t border-stone-200 dark:border-stone-700',
                      row.status !== 'new' && 'bg-amber-50 dark:bg-amber-900/20',
                    )}
                    data-status={row.status}
                    data-testid="import-row"
                  >
                    <td className="px-2 py-1.5">
                      <Hanzi className="text-base font-semibold">{row.row.traditional}</Hanzi>
                    </td>
                    <td className="px-2 py-1.5">{row.row.pinyin || '—'}</td>
                    <td className="max-w-48 truncate px-2 py-1.5">{row.row.definition || '—'}</td>
                    <td className="px-2 py-1.5">{domainOverride || row.row.domain || 'custom'}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 font-semibold',
                          row.status === 'new'
                            ? 'bg-jade-500/15 text-jade-600'
                            : 'bg-amber-200 text-amber-900',
                        )}
                      >
                        {row.status === 'new' ? 'new' : 'duplicate'}
                      </span>
                      {row.messages.length > 0 && (
                        <span className="block text-stone-500" title={row.messages.join(' ')}>
                          {row.messages[0]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > PREVIEW_LIMIT && (
              <p className="px-2 py-1.5 text-xs text-stone-500">
                …and {preview.rows.length - PREVIEW_LIMIT} more rows.
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Count({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'jade' | 'amber' | 'stone';
}) {
  const tones = {
    jade: 'text-jade-600',
    amber: 'text-amber-700 dark:text-amber-300',
    stone: 'text-stone-600 dark:text-stone-300',
  };
  return (
    <div className="rounded-lg bg-stone-100 px-2 py-2 dark:bg-stone-800">
      <dt className="text-xs font-semibold text-stone-500 dark:text-stone-400">{label}</dt>
      <dd className={cn('text-xl font-extrabold', tones[tone])}>{value}</dd>
    </div>
  );
}
