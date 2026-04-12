import { useRef, useState } from 'react';
import { exportDatabase, importDatabase, downloadJson, exportAsUrl } from '../../db/export-import';
import { Card } from '../../components/shared/Card';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';

export function ExportImport() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const json = await exportDatabase();
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(json, `hausverwaltung-backup-${date}.json`);
      setMessage({ type: 'success', text: 'Backup erfolgreich heruntergeladen.' });
    } catch {
      setMessage({ type: 'error', text: 'Export fehlgeschlagen.' });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      JSON.parse(text); // Validate JSON
      setPendingFile(text);
      setConfirmOpen(true);
    } catch {
      setMessage({ type: 'error', text: 'Ungültige JSON-Datei.' });
    }

    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;

    setImporting(true);
    setConfirmOpen(false);

    try {
      await importDatabase(pendingFile);
      setMessage({ type: 'success', text: 'Daten erfolgreich importiert. Seite wird neu geladen...' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Import fehlgeschlagen.',
      });
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  const handleShareUrl = async () => {
    try {
      const url = await exportAsUrl();
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setMessage({ type: 'success', text: 'Transfer-Link in Zwischenablage kopiert.' });
    } catch {
      setMessage({ type: 'error', text: 'Link-Erstellung fehlgeschlagen.' });
    }
  };

  return (
    <>
      <Card title="Daten-Backup">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleExport}
            className="flex-1 px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors"
          >
            Export (JSON)
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={importing}
            className="flex-1 px-4 py-2 text-sm border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            {importing ? 'Importiert...' : 'Import (JSON)'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <div className="mt-3 pt-3 border-t border-stone-100">
          <button
            onClick={handleShareUrl}
            className="w-full px-4 py-2 text-sm border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Transfer-Link erstellen (zum Teilen per URL)
          </button>
          {shareUrl && (
            <div className="mt-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-xs font-mono bg-stone-50 text-stone-600"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <p className="text-xs text-stone-400 mt-1">
                Link auf dem anderen Gerät im Browser öffnen, um die Daten zu importieren.
              </p>
            </div>
          )}
        </div>

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

      <ConfirmDialog
        open={confirmOpen}
        title="Daten importieren?"
        message="Alle vorhandenen Daten werden durch den Import überschrieben. Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Importieren"
        onConfirm={handleConfirmImport}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingFile(null);
        }}
        danger
      />
    </>
  );
}
