import { useEffect, useRef, type ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  side?: 'right' | 'bottom';
}

export function Drawer({ open, onClose, title, children, side = 'right' }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    prev.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const f = ref.current?.querySelector<HTMLElement>(
        'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
      );
      f?.focus();
    }, 0);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
      prev.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sideCls =
    side === 'bottom'
      ? 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl'
      : 'right-0 top-0 bottom-0 w-full max-w-sm';

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Drawer'}
        className={`absolute ${sideCls} bg-white dark:bg-stone-800 shadow-2xl flex flex-col`}
      >
        {title && (
          <header className="px-5 py-4 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </header>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
