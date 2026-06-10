import { useRegisterSW } from "virtual:pwa-register/react";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("SW Registrierung fehlgeschlagen:", error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-4 right-4 z-50 max-w-sm bg-surface border border-border rounded-lg shadow-lg p-4 no-print"
    >
      <p className="text-sm text-fg mb-3">Eine neue Version ist verfügbar.</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="px-3 py-1.5 text-xs rounded-lg bg-surface-sunken text-fg-muted hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
        >
          Später
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:bg-zinc-900 dark:hover:bg-white transition-colors"
        >
          Jetzt laden
        </button>
      </div>
    </div>
  );
}
