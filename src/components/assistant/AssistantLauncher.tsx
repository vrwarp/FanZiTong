import { useAssistant } from '@/lib/assistant/assistantContext';
import { cn } from '@/lib/util/cn';

const DOT: Record<string, string> = {
  connected: 'bg-jade-500',
  connecting: 'bg-amber-brand',
  offline: 'bg-stone-400',
  unauthorized: 'bg-red-500',
  error: 'bg-red-500',
};

/**
 * The way in, everywhere except a study prompt.
 *
 * A real <button>, so the study screen's tap-anywhere-to-reveal handler ignores
 * it, and it sits above the bottom nav rather than over the rating buttons.
 */
export function AssistantLauncher() {
  const assistant = useAssistant();
  if (!assistant.available) return null;

  const { connection, busy } = assistant.state;
  return (
    <button
      type="button"
      data-testid="assistant-launcher"
      onClick={() => assistant.setOpen(true)}
      aria-label="Open the assistant"
      className={cn(
        'safe-bottom fixed right-4 bottom-24 z-40 flex min-h-14 min-w-14 items-center justify-center rounded-full',
        'bg-brand-600 text-2xl text-white shadow-lg hover:bg-brand-700 active:bg-brand-800',
      )}
    >
      <span aria-hidden="true">{busy ? '…' : '✨'}</span>
      <span
        aria-hidden="true"
        className={cn(
          'absolute right-1 bottom-1 h-3 w-3 rounded-full border-2 border-white dark:border-ink',
          DOT[connection] ?? 'bg-stone-400',
        )}
      />
    </button>
  );
}
