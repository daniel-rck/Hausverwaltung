import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('SW Registrierung fehlgeschlagen:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-4 right-4 z-50 max-w-sm bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg p-4 no-print"
    >
      <p className="text-sm text-stone-700 dark:text-stone-200 mb-3">
        Eine neue Version ist verfügbar.
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="px-3 py-1.5 text-xs rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors"
        >
          Später
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="px-3 py-1.5 text-xs rounded-lg bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 hover:bg-stone-900 dark:hover:bg-white transition-colors"
        >
          Jetzt laden
        </button>
      </div>
    </div>
  );
}
