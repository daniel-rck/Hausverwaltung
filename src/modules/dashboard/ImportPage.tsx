import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Inflate } from 'pako';
import { importDatabase } from '../../db/export-import';
import { Card } from '../../components/shared/Card';
import { syncService } from '../../sync/service';
import { useSyncStatus } from '../../sync/useSyncStatus';

const MAX_PAYLOAD_BASE64 = 512 * 1024; // 512 KB komprimiert via URL
const MAX_DECOMPRESSED_BYTES = 20 * 1024 * 1024; // 20 MB JSON-Limit gegen ZIP-Bomben

function safeInflateToString(binary: Uint8Array): string {
  const inflator = new Inflate({ to: 'string' });
  let totalLen = 0;
  let result = '';
  inflator.onData = (chunk) => {
    const text = chunk as unknown as string;
    totalLen += text.length;
    if (totalLen > MAX_DECOMPRESSED_BYTES) {
      throw new Error(
        `Import-Daten überschreiten ${Math.round(MAX_DECOMPRESSED_BYTES / 1024 / 1024)} MB Grenze.`,
      );
    }
    result += text;
  };
  inflator.push(binary, true);
  if (inflator.err) {
    throw new Error(inflator.msg || 'Dekompression fehlgeschlagen.');
  }
  return result;
}

type ParsedPayload =
  | { ok: true; jsonData: string }
  | { ok: false; error: string };

function parsePayload(payload: string | undefined): ParsedPayload {
  if (!payload) {
    return { ok: false, error: 'Kein Import-Payload in der URL gefunden.' };
  }
  try {
    if (payload.length > MAX_PAYLOAD_BASE64) {
      throw new Error('Import-Link ist zu groß. Bitte JSON-Datei verwenden.');
    }
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const decompressed = safeInflateToString(binary);
    const parsed = JSON.parse(decompressed);
    if (parsed.app !== 'hausverwaltung') {
      throw new Error('Ungültige Daten: Kein Hausverwaltung-Export.');
    }
    return { ok: true, jsonData: decompressed };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Import-Daten konnten nicht gelesen werden.',
    };
  }
}

type Phase = 'confirm' | 'importing' | 'success' | 'error';

export function ImportPage() {
  const { payload } = useParams<{ payload: string }>();
  const navigate = useNavigate();
  const parsed = useMemo(() => parsePayload(payload), [payload]);

  const [phase, setPhase] = useState<Phase | null>(null);
  const [importError, setImportError] = useState('');
  const syncState = useSyncStatus();
  const syncActive = syncState.status !== 'disconnected';

  const status: Phase = phase ?? (parsed.ok ? 'confirm' : 'error');
  const error = phase === 'error' ? importError : parsed.ok ? '' : parsed.error;

  const handleImport = async () => {
    if (!parsed.ok) return;
    setPhase('importing');
    try {
      // Sync VOR dem Import abklemmen, sonst pusht der Debounce-Timer
      // den (potenziell alten) Backup-Stand hoch und überschreibt damit
      // den Datenbestand auf allen verknüpften Geräten.
      if (syncService.getState().status !== 'disconnected') {
        await syncService.disconnect();
      }
      await importDatabase(parsed.jsonData);
      setPhase('success');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import fehlgeschlagen.');
      setPhase('error');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card title="Daten importieren">
        {status === 'confirm' && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Es wurden Daten in der URL gefunden. Alle vorhandenen Daten werden
              durch den Import <strong>überschrieben</strong>.
              {syncActive && (
                <>
                  {' '}
                  Der Multi-Device-Sync wird dabei zurückgesetzt — sonst würden
                  die importierten Daten auf alle verknüpften Geräte gepusht.
                  Du kannst dich danach wieder verknüpfen.
                </>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                className="px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors"
              >
                Jetzt importieren
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {status === 'importing' && (
          <p className="text-sm text-stone-500 dark:text-stone-400">Import läuft...</p>
        )}

        {status === 'success' && (
          <p className="text-sm text-green-600">
            Daten erfolgreich importiert. Sie werden weitergeleitet...
          </p>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
            >
              Zum Dashboard
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
