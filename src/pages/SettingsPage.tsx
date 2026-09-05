import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ImportDialog, type ImportSource } from '@/components/vocab/ImportDialog';
import { useLiveQuery } from 'dexie-react-hooks';
import { META_KEYS, repository } from '@/db/repository';
import { useCardsOrEmpty, useReviewLogsOrEmpty } from '@/hooks/useCards';
import { useSettings } from '@/hooks/useSettings';
import { downloadTextFile, timestampForFilename } from '@/lib/io/download';
import { serializeJsonDeck, toJsonDeck } from '@/lib/io/json';
import { cn } from '@/lib/util/cn';
import { resetIntro } from '@/lib/util/intro';
import { describeLastChecked, formatBuildStamp } from '@/lib/pwa/updatePolicy';
import { useAppUpdate } from '@/pwa/appUpdateContext';
import { resetAppCache } from '@/pwa/resetAppCache';
import { useNow } from '@/hooks/useNow';
import {
  DOMAIN_CATEGORIES,
  DOMAIN_LABELS,
  type DomainCategory,
  type ThemePreference,
} from '@/types';

const REVEAL_OPTIONS = [
  { value: 0, label: 'Manual tap only (recommended)' },
  { value: 3000, label: 'Auto-reveal after 3 s' },
  { value: 5000, label: 'Auto-reveal after 5 s' },
  { value: 8000, label: 'Auto-reveal after 8 s' },
  { value: 12000, label: 'Auto-reveal after 12 s' },
];

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const cards = useCardsOrEmpty();
  const logs = useReviewLogsOrEmpty();
  const [confirmReset, setConfirmReset] = useState(false);
  const [importSource, setImportSource] = useState<ImportSource | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [storage, setStorage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastBackupAt = useLiveQuery(() => repository.getMeta(META_KEYS.lastBackupAt), []);
  const appUpdate = useAppUpdate();
  const now = useNow();
  const [confirmCacheReset, setConfirmCacheReset] = useState(false);
  const checked = describeLastChecked(appUpdate.lastCheckedAt, now.getTime());
  const updateStatusText =
    appUpdate.status === 'update-ready'
      ? 'A new version is ready to install.'
      : appUpdate.status === 'checking'
        ? 'Checking for a new version…'
        : appUpdate.status === 'error'
          ? `Could not reach the server — ${checked}. It will try again when you are back online.`
          : appUpdate.status === 'unsupported'
            ? 'This browser is not caching the app, so you always load the latest version.'
            : appUpdate.status === 'up-to-date'
              ? `You are on the latest version — ${checked}.`
              : 'Not checked yet.';

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((est) => {
        if (est.usage !== undefined)
          setStorage(`${(est.usage / 1024 / 1024).toFixed(1)} MB used on this device`);
      })
      .catch(() => undefined);
  }, []);

  const exportBackup = () => {
    const deck = toJsonDeck(cards, {
      deckName: 'FanZiTong full backup',
      reviewLogs: logs,
      settings,
    });
    downloadTextFile(
      `fanzitong-backup-${timestampForFilename()}.json`,
      serializeJsonDeck(deck),
      'application/json',
    );
  };

  const resetCache = async () => {
    await resetAppCache();
    window.location.reload();
  };

  const resetAll = async () => {
    await repository.clearAll();
    window.location.reload();
  };

  const toggleDomain = (domain: DomainCategory) => {
    const next = settings.activeDomains.includes(domain)
      ? settings.activeDomains.filter((d) => d !== domain)
      : [...settings.activeDomains, domain];
    void update({ activeDomains: next });
  };

  return (
    <div className="flex flex-col gap-4" data-testid="settings-page">
      <PageHeader
        title="Settings"
        zh="設定"
        subtitle="Scheduling, study limits, theme and backups"
      />

      <section className="card-surface flex flex-col gap-4 p-4">
        <h2 className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400">
          Scheduling (FSRS)
        </h2>
        <Field
          label={`Target retention: ${Math.round(settings.targetRetention * 100)}%`}
          htmlFor="retention"
          hint="Higher = more reviews, fewer forgotten cards. 90% is the recommended default."
        >
          <input
            id="retention"
            type="range"
            min={70}
            max={97}
            step={1}
            value={Math.round(settings.targetRetention * 100)}
            onChange={(e) => void update({ targetRetention: Number(e.target.value) / 100 })}
            className="h-12 w-full accent-brand-600"
            data-testid="setting-retention"
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <NumberField
            key={`reviews-${settings.maxDailyReviews}`}
            id="maxReviews"
            label="Max reviews / day"
            value={settings.maxDailyReviews}
            onChange={(v) => void update({ maxDailyReviews: v })}
            testId="setting-max-reviews"
          />
          <NumberField
            key={`new-${settings.maxDailyNewCards}`}
            id="maxNew"
            label="Max new / day"
            value={settings.maxDailyNewCards}
            onChange={(v) => void update({ maxDailyNewCards: v })}
            testId="setting-max-new"
          />
          <NumberField
            key={`leech-${settings.leechThreshold}`}
            id="leech"
            label="Flag after N forgets"
            value={settings.leechThreshold}
            min={1}
            onChange={(v) => void update({ leechThreshold: v })}
            testId="setting-leech"
          />
        </div>
      </section>

      <section className="card-surface flex flex-col gap-4 p-4">
        <h2 className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400">Study</h2>
        <Field
          label="Pinyin reveal"
          htmlFor="reveal"
          hint="Pinyin is never shown with the prompt. Auto-reveal only shortens how long you must wait."
        >
          <select
            id="reveal"
            className={inputClass}
            value={settings.pinyinRevealDelayMs}
            onChange={(e) => void update({ pinyinRevealDelayMs: Number(e.target.value) })}
            data-testid="setting-reveal"
          >
            {REVEAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold text-stone-700 dark:text-stone-200">
            Active domains
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DOMAIN_CATEGORIES.map((domain) => {
              const active = settings.activeDomains.includes(domain);
              return (
                <label
                  key={domain}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-semibold',
                    active
                      ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200'
                      : 'border-stone-300 text-stone-500 dark:border-stone-600',
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={active}
                    onChange={() => toggleDomain(domain)}
                    data-testid={`domain-${domain}`}
                  />
                  <span aria-hidden>{DOMAIN_LABELS[domain].emoji}</span>
                  {DOMAIN_LABELS[domain].en}{' '}
                  <span lang="zh-Hant-TW">{DOMAIN_LABELS[domain].zh}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className="card-surface flex flex-col gap-3 p-4">
        <h2 className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400">
          Appearance
        </h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
          {(['system', 'light', 'dark'] as ThemePreference[]).map((theme) => (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={settings.theme === theme}
              onClick={() => void update({ theme })}
              data-testid={`theme-${theme}`}
              className={cn(
                'min-h-12 rounded-xl border text-sm font-semibold capitalize',
                settings.theme === theme
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-stone-300 dark:border-stone-600',
              )}
            >
              {theme}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          className="self-start"
          onClick={() => {
            resetIntro();
            setNotice('The intro and the rating guide will show again.');
          }}
          data-testid="show-intro"
        >
          Show the intro again
        </Button>
      </section>

      <section className="card-surface flex flex-col gap-3 p-4">
        <h2 className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400">Data</h2>
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Everything lives in this browser. Back up regularly: the JSON backup contains cards, FSRS
          state, review history and settings.{' '}
          {storage && <span className="text-stone-500">{storage}.</span>}
        </p>
        <p className="text-sm font-semibold" data-testid="last-backup">
          Last backup: {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : 'never'}
        </p>
        {notice && (
          <p
            role="status"
            className="rounded-lg bg-jade-500/10 px-3 py-2 text-sm text-jade-600"
            data-testid="settings-notice"
          >
            {notice}
          </p>
        )}
        <input
          ref={fileInput}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="sr-only"
          aria-label="Restore backup file"
          data-testid="backup-file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setImportSource({ fileName: file.name, text: await file.text() });
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportBackup} data-testid="export-backup">
            ⬇️ Export full backup
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInput.current?.click()}
            data-testid="import-backup"
          >
            ⬆️ Restore backup
          </Button>
          <Button
            variant="outline"
            className="border-red-400 text-red-700 hover:bg-red-50 dark:text-red-300"
            onClick={() => setConfirmReset(true)}
            data-testid="reset-data"
          >
            Reset all data
          </Button>
        </div>
      </section>

      <section className="card-surface flex flex-col gap-3 p-4" aria-labelledby="about-heading">
        <h2
          id="about-heading"
          className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400"
        >
          App version
        </h2>
        <p className="text-sm">
          <span lang="zh-Hant-TW">繁字通</span> FanZiTong v{__APP_VERSION__}
          <span className="block text-xs text-stone-500 dark:text-stone-400" data-testid="build-id">
            {formatBuildStamp(__BUILD_ID__, __BUILD_TIME__)}
          </span>
        </p>
        <p className="text-sm text-stone-600 dark:text-stone-300" data-testid="update-status">
          {updateStatusText}
        </p>
        <div className="flex flex-wrap gap-2">
          {appUpdate.updateReady ? (
            <Button onClick={appUpdate.applyUpdate} data-testid="install-update">
              Install update
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={appUpdate.checkNow}
              disabled={appUpdate.status === 'checking' || appUpdate.status === 'unsupported'}
              data-testid="check-updates"
            >
              Check for updates
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setConfirmCacheReset(true)}
            data-testid="reset-cache"
          >
            Reset app cache
          </Button>
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          “Reset app cache” reinstalls the app files if an update will not take. It does not touch
          your words, review history or settings. On iPhone use Share → “Add to Home Screen”.
        </p>
      </section>

      <ImportDialog
        source={importSource}
        existing={cards}
        onClose={() => setImportSource(null)}
        onImported={(s) => {
          setImportSource(null);
          setNotice(
            `Restored ${s.inserted + s.updated} cards${s.logs ? ` and ${s.logs} review logs` : ''}.`,
          );
        }}
      />

      <Modal
        open={confirmCacheReset}
        title="Reset app cache?"
        onClose={() => setConfirmCacheReset(false)}
        testId="cache-reset-dialog"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCacheReset(false)}>
              Cancel
            </Button>
            <Button onClick={() => void resetCache()} data-testid="confirm-cache-reset">
              Reset cache
            </Button>
          </>
        }
      >
        <p className="text-sm">
          This reinstalls the app files and reloads. Your words, review history and settings stay
          exactly as they are — nothing you have studied is lost.
        </p>
      </Modal>

      <Modal
        open={confirmReset}
        title="Reset all data?"
        onClose={() => setConfirmReset(false)}
        testId="reset-dialog"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={resetAll} data-testid="confirm-reset">
              Erase everything
            </Button>
          </>
        }
      >
        <p className="text-sm">
          This removes {cards.length} cards and {logs.length} answers from this device and reloads
          the starter deck. Export a backup first if you want to keep your progress.
        </p>
      </Modal>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  testId,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  testId: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = Math.max(min, Math.floor(Number(draft)));
    if (Number.isFinite(n) && n !== value) onChange(n);
    else setDraft(String(value));
  };
  return (
    <Field label={label} htmlFor={id}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        className={inputClass}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        data-testid={testId}
      />
    </Field>
  );
}
