import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { textareaClass } from '@/components/ui/Field';
import { useAssistant } from '@/lib/assistant/assistantContext';
import { prepareImage } from '@/lib/assistant/images';
import type { ToolStep, TranscriptItem } from '@/lib/assistant/store';
import { cn } from '@/lib/util/cn';
import { RichText } from './RichText';

const TOOL_LABELS: Record<string, string> = {
  deck_overview: 'Looking over your deck',
  deck_search: 'Searching your deck',
  deck_get_cards: 'Reading cards',
  deck_upsert_cards: 'Writing cards',
  deck_delete_cards: 'Removing cards',
  deck_merge_cards: 'Merging cards',
  deck_review_logs: 'Reading your answers',
  stats_overview: 'Checking your progress',
  study_context: 'Checking what you are looking at',
  char_info: 'Looking up characters',
  menu_fit: 'Checking the menu sections',
  suggest_drill: 'Setting up practice',
  settings_update: 'Changing a setting',
};

function toolLabel(tool: string): string {
  const bare = tool.replace(/^mcp__fanzitong__/, '');
  return TOOL_LABELS[bare] ?? bare.replace(/_/g, ' ');
}

function ToolRow({ step, onUndo }: { step: ToolStep; onUndo: (batchId: string) => void }) {
  return (
    <div
      data-testid="assistant-tool-step"
      className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400"
    >
      <span aria-hidden="true">
        {step.status === 'running' ? '⋯' : step.status === 'failed' ? '⚠' : '✓'}
      </span>
      <span>{toolLabel(step.tool)}</span>
      {step.summary && <span className="text-stone-400">· {step.summary}</span>}
      {step.batchIds?.map((batchId) => (
        <button
          key={batchId}
          type="button"
          data-testid="assistant-undo"
          onClick={() => onUndo(batchId)}
          className="rounded-full border border-stone-300 px-2 py-0.5 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-700"
        >
          Undo
        </button>
      ))}
    </div>
  );
}

function Item({ item, onUndo }: { item: TranscriptItem; onUndo: (batchId: string) => void }) {
  if (item.kind === 'user') {
    return (
      <div className="flex flex-col items-end gap-1">
        {item.label && <span className="text-xs text-stone-500">about {item.label}</span>}
        <p className="max-w-[85%] rounded-2xl bg-brand-600 px-3 py-2 text-white">
          {item.text}
          {item.images ? ` (${item.images} photo${item.images > 1 ? 's' : ''})` : ''}
        </p>
      </div>
    );
  }
  if (item.kind === 'assistant') {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="max-w-[92%] space-y-2 rounded-2xl bg-stone-100 px-3 py-2 text-ink dark:bg-ink-3 dark:text-stone-100">
          {item.text ? (
            <RichText text={item.text} />
          ) : (
            <p className="text-stone-500 dark:text-stone-400">Working…</p>
          )}
        </div>
        {item.steps.map((step) => (
          <ToolRow key={step.callId} step={step} onUndo={onUndo} />
        ))}
      </div>
    );
  }
  if (item.kind === 'drill') {
    return (
      <Link
        to={item.url}
        data-testid="assistant-drill"
        className="rounded-xl border border-brand-600 px-3 py-2 text-center font-semibold text-brand-600 dark:border-brand-500 dark:text-brand-500"
      >
        {item.label}
      </Link>
    );
  }
  return (
    <p
      role={item.level === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg px-3 py-2 text-sm',
        item.level === 'error'
          ? 'bg-red-100 text-red-800'
          : item.level === 'warning'
            ? 'bg-amber-100 text-amber-900'
            : 'bg-jade-500/10 text-jade-600',
      )}
    >
      {item.text}
    </p>
  );
}

const CONNECTION_TEXT: Record<string, string> = {
  connecting: 'Connecting to your assistant…',
  offline: 'Your assistant is offline. Everything else still works.',
  unauthorized: 'Your assistant refused this pairing. Check the settings.',
  error: 'Your assistant is not reachable.',
  unconfigured: 'No assistant is set up yet. Add one in Settings.',
};

export function AssistantPanel() {
  const assistant = useAssistant();
  const { state } = assistant;
  const [draft, setDraft] = useState('');
  const [images, setImages] = useState<{ mediaType: string; data: string }[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.open) endRef.current?.scrollIntoView({ block: 'end' });
  }, [state.transcript, state.open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text && images.length === 0) return;
    assistant.ask(text || 'What words are in this picture?', {
      images,
      profile: images.length ? 'deep' : undefined,
    });
    setDraft('');
    setImages([]);
  };

  const attach = async (files: FileList | null) => {
    if (!files?.length) return;
    setImageError(null);
    try {
      const prepared = await Promise.all(Array.from(files).slice(0, 3).map(prepareImage));
      setImages(prepared.map((p) => ({ mediaType: p.mediaType, data: p.data })));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'That image could not be used.');
    }
  };

  const notice = CONNECTION_TEXT[state.connection];

  return (
    <Modal
      open={state.open}
      onClose={() => assistant.setOpen(false)}
      title="Assistant 助教"
      testId="assistant-panel"
      className="w-[min(96vw,40rem)]"
      footer={
        <form onSubmit={submit} className="flex w-full flex-col gap-2">
          {imageError && (
            <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
              {imageError}
            </p>
          )}
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask for words, sentences, or help with a character"
            data-testid="assistant-composer"
            rows={2}
            className={cn(textareaClass, 'min-h-16')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit(event);
            }}
          />
          <div className="flex items-center gap-2">
            <label className="tap-target flex cursor-pointer items-center rounded-xl px-2 text-xl">
              <span aria-hidden="true">📷</span>
              <span className="sr-only">Add a photo</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => void attach(event.target.files)}
              />
            </label>
            {images.length > 0 && (
              <span className="text-xs text-stone-500">
                {images.length} photo{images.length > 1 ? 's' : ''} attached
              </span>
            )}
            <span className="flex-1" />
            {state.busy ? (
              <Button variant="outline" size="sm" onClick={assistant.interrupt} type="button">
                Stop
              </Button>
            ) : (
              <Button size="sm" type="submit" disabled={state.connection !== 'connected'}>
                Send
              </Button>
            )}
          </div>
        </form>
      }
    >
      <div className="flex flex-col gap-3 px-1">
        {notice && (
          <p role="status" className="rounded-lg bg-stone-100 px-3 py-2 text-sm dark:bg-ink-3">
            {state.connectionDetail ?? notice}
          </p>
        )}
        {state.transcript.length === 0 && !notice && (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Ask for an example sentence, some new words, or why a character keeps catching you out.
          </p>
        )}
        {state.transcript.map((item) => (
          <Item key={item.id} item={item} onUndo={(batchId) => void assistant.undo(batchId)} />
        ))}
        {state.activity && state.busy && (
          <p
            data-testid="assistant-activity"
            className="text-xs text-stone-500 italic dark:text-stone-400"
          >
            {state.activity}
          </p>
        )}
        {state.suggestion && !state.busy && (
          <button
            type="button"
            onClick={() => assistant.ask(state.suggestion!)}
            className="self-start rounded-full border border-stone-300 px-3 py-1 text-sm text-stone-600 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            {state.suggestion}
          </button>
        )}
        <div ref={endRef} />
      </div>
    </Modal>
  );
}
