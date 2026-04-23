import { useState } from 'react';
import { Card } from '../shared/Card';
import { useSyncStatus } from '../../sync/useSyncStatus';
import { syncService } from '../../sync/service';
import { isOneDriveConfigured } from '../../sync/onedrive-client';

function formatAbsolute(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SyncSettings() {
  const state = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const configured = isOneDriveConfigured();

  const handleConnect = async () => {
    setMessage(null);
    setBusy(true);
    try {
      await syncService.connect();
      setMessage({ type: 'success', text: 'Mit OneDrive verbunden.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Verbindung fehlgeschlagen.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setMessage(null);
    setBusy(true);
    try {
      await syncService.disconnect();
      setMessage({ type: 'success', text: 'OneDrive getrennt.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async () => {
    setBusy(true);
    try {
      await syncService.syncNow();
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <Card title="Multi-Device-Sync">
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Die Synchronisation zwischen Geräten erfolgt über deinen eigenen
          OneDrive-Speicher — dieser Build ist jedoch ohne OneDrive-Zugangs-ID
          ausgeliefert worden.
        </p>
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          Setze <code>VITE_ONEDRIVE_CLIENT_ID</code> beim Build, um die Funktion
          zu aktivieren. Details siehe README.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Multi-Device-Sync (OneDrive)">
      <div className="text-sm text-stone-600 dark:text-stone-300 mb-3">
        Synchronisiere deine Daten zwischen mehreren Geräten über deinen eigenen
        OneDrive-Speicher. Die App legt eine einzige Datei im Ordner
        <code className="mx-1 px-1 bg-stone-100 dark:bg-stone-700 rounded">
          /Apps/Hausverwaltung/
        </code>
        ab — kein fremder Server wird verwendet.
      </div>

      {state.status === 'disconnected' ? (
        <button
          onClick={handleConnect}
          disabled={busy}
          className="w-full px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors disabled:opacity-50"
        >
          {busy ? 'Verbinde…' : 'Mit OneDrive verbinden'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-stone-800 dark:text-stone-100">
                {state.accountEmail ?? 'OneDrive-Konto'}
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400">
                Status:{' '}
                {state.status === 'idle' && 'synchronisiert'}
                {state.status === 'syncing' && 'synchronisiere…'}
                {state.status === 'connecting' && 'verbinde…'}
                {state.status === 'offline' && 'offline (Daten werden später synchronisiert)'}
                {state.status === 'error' && `Fehler: ${state.lastError ?? 'unbekannt'}`}
              </div>
              {state.lastSyncedAt && (
                <div className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  Letzter Sync: {formatAbsolute(state.lastSyncedAt)}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleSyncNow}
              disabled={busy || state.status === 'syncing'}
              className="flex-1 px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              Jetzt synchronisieren
            </button>
            <button
              onClick={handleDisconnect}
              disabled={busy}
              className="flex-1 px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              OneDrive trennen
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
            <input
              type="checkbox"
              checked={state.autoSync}
              onChange={(e) => syncService.setAutoSync(e.target.checked)}
            />
            Automatisch synchronisieren (alle 20 s + bei Änderungen)
          </label>
        </div>
      )}

      {message && (
        <p
          className={`mt-3 text-sm ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}
    </Card>
  );
}
