import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/util/cn';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  testId?: string;
}

/** Accessible dialog built on the native <dialog> element. */
export function Modal({ open, title, onClose, children, footer, className, testId }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-testid={testId}
      aria-labelledby={`${testId ?? 'modal'}-title`}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose?.();
      }}
      className={cn(
        'm-auto w-[min(92vw,32rem)] max-h-[85dvh] overflow-hidden rounded-2xl bg-white p-0 text-ink shadow-2xl backdrop:bg-black/50 dark:bg-ink-2 dark:text-stone-100',
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-700">
            <h2 id={`${testId ?? 'modal'}-title`} className="text-lg font-bold">
              {title}
            </h2>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="tap-target -mr-2 rounded-full text-2xl leading-none text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700"
              >
                ×
              </button>
            )}
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-stone-200 px-5 py-3 dark:border-stone-700">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
