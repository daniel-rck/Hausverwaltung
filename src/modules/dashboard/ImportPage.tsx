import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Inflate } from 'pako';
import { importDatabase } from '../../db/export-import';
import { Card } from '../../components/shared/Card';

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

export function ImportPage() {
  const { payload } = useParams<{ payload: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'confirm' | 'importing' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [jsonData, setJsonData] = useState<string | null>(null);

  useEffect(() => {
    if (!payload) {
      setStatus('error');
      setError('Kein Import-Payload in der URL gefunden.');
      return;
    }

    try {
      if (payload.length > MAX_PAYLOAD_BASE64) {
        throw new Error('Import-Link ist zu groß. Bitte JSON-Datei verwenden.');
      }

      // Decode base64url → binary → inflate (mit Größenlimit) → JSON string
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const decompressed = safeInflateToString(binary);

      // Validate JSON structure
      const parsed = JSON.parse(decompressed);
      if (parsed.app !== 'hausverwaltung') {
        throw new Error('Ungültige Daten: Kein Hausverwaltung-Export.');
      }

      setJsonData(decompressed);
      setStatus('confirm');
    } catch (err) {
      setStatus('error');
      setError(
        err instanceof Error ? err.message : 'Import-Daten konnten nicht gelesen werden.',
      );
    }
  }, [payload]);

  const handleImport = async () => {
    if (!jsonData) return;

    setStatus('importing');
    try {
      await importDatabase(jsonData);
      setStatus('success');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Import fehlgeschlagen.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card title="Daten importieren">
        {status === 'loading' && (
          <p className="text-sm text-stone-500 dark:text-stone-400">Daten werden gelesen...</p>
        )}

        {status === 'confirm' && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Es wurden Daten in der URL gefunden. Alle vorhandenen Daten werden
              durch den Import <strong>überschrieben</strong>.
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
