import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inflate } from 'pako';
import { importDatabase } from '../../db/export-import';
import { Card } from '../../components/shared/Card';

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
      // Decode base64url → binary → inflate → JSON string
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const decompressed = inflate(binary, { to: 'string' });

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
