import { Hanzi } from '@/components/ui/Hanzi';
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
 * The way in, on the screens that carry the bottom nav.
 *
 * It is mounted by the shell rather than at the root, because its offset exists
 * to clear that nav. Study and the drill runner render outside the shell and
 * own their bottom edge — rating buttons, answer buttons — so they put the
 * assistant in their own header instead of floating a disc over the controls.
 *
 * A real <button>, so the study screen's tap-anywhere-to-reveal handler ignores
 * it. The mark is 助, from the panel's own 助教: a sparkle on this red read as
 * a flag, which is not the country this app is about.
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
      <Hanzi aria-hidden="true" className="leading-none">
        {busy ? '…' : '助'}
      </Hanzi>
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
