import { useEffect, useRef, useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);

  // Auto-Focus auf Confirm-Button beim Öffnen
  useEffect(() => {
    if (open) {
      setBusy(false);
      // Verzögert, damit das Element gemountet ist
      const t = setTimeout(() => confirmRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Escape schließt; Tab in Dialog gefangen halten (einfacher Focus-Trap)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!busy) onCancel();
        return;
      }
      if (e.key === 'Tab') {
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (!first || !last) return;
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onClick={(e) => {
        // Klick auf Overlay schließt (außer auf Dialog-Inhalt)
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="bg-white dark:bg-stone-800 rounded-xl shadow-lg max-w-sm w-full p-5">
        <h3
          id="confirm-title"
          className="text-base font-semibold text-stone-800 dark:text-stone-100 mb-2"
        >
          {title}
        </h3>
        <p
          id="confirm-message"
          className="text-sm text-stone-600 dark:text-stone-400 mb-4"
        >
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`px-4 py-2 text-sm rounded-lg text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-stone-800 hover:bg-stone-900 dark:bg-stone-600 dark:hover:bg-stone-500'
            }`}
          >
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
