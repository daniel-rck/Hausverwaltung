import { useRef, useState } from "react";
import {
  downloadJson,
  exportAsUrl,
  exportDatabase,
  importDatabase,
} from "../../lib/db/export-import";
import { syncService } from "../../lib/sync/service";
import { useSyncStatus } from "../../lib/sync/useSyncStatus";
import { Card } from "../../lib/ui/shared/Card";
import { ConfirmDialog } from "../../lib/ui/shared/ConfirmDialog";

export function ExportImport() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const syncState = useSyncStatus();
  const syncActive = syncState.status !== "disconnected";

  const handleExport = async () => {
    try {
      const json = await exportDatabase();
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(json, `hausverwaltung-backup-${date}.json`);
      setMessage({ type: "success", text: "Backup erfolgreich heruntergeladen." });
    } catch {
      setMessage({ type: "error", text: "Export fehlgeschlagen." });
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
      setMessage({ type: "error", text: "Ungültige JSON-Datei." });
    }

    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;

    setImporting(true);
    setConfirmOpen(false);

    try {
      // Sync VOR dem Import abklemmen, sonst pusht der Debounce-Timer
      // den (potenziell alten) Backup-Stand hoch und überschreibt damit
      // den Datenbestand auf allen verknüpften Geräten.
      if (syncService.getState().status !== "disconnected") {
        await syncService.disconnect();
      }
      await importDatabase(pendingFile);
      setMessage({
        type: "success",
        text: "Daten erfolgreich importiert. Seite wird neu geladen...",
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Import fehlgeschlagen.",
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
      setMessage({ type: "success", text: "Transfer-Link in Zwischenablage kopiert." });
    } catch {
      setMessage({ type: "error", text: "Link-Erstellung fehlgeschlagen." });
    }
  };

  return (
    <>
      <Card title="Daten-Backup">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 px-4 py-2 text-sm bg-fg text-surface rounded-lg hover:opacity-90 transition-colors"
          >
            Export (JSON)
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={importing}
            className="flex-1 px-4 py-2 text-sm border border-border text-fg rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-50"
          >
            {importing ? "Importiert..." : "Import (JSON)"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={handleShareUrl}
            className="w-full px-4 py-2 text-sm border border-border text-fg rounded-lg hover:bg-surface-muted transition-colors"
          >
            Transfer-Link erstellen (zum Teilen per URL)
          </button>
          {shareUrl && (
            <div className="mt-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full border border-border rounded-lg px-3 py-1.5 text-xs font-mono bg-surface-muted text-fg-muted"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <p className="text-xs text-fg-subtle mt-1">
                Link auf dem anderen Gerät im Browser öffnen, um die Daten zu importieren.
              </p>
            </div>
          )}
        </div>

        {message && (
          <p
            className={`mt-3 text-sm ${
              message.type === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Daten importieren?"
        message={
          syncActive
            ? "Alle vorhandenen Daten werden durch den Import überschrieben und der Multi-Device-Sync wird zurückgesetzt — sonst würden die alten Backup-Daten auf alle verknüpften Geräte gepusht. Du kannst dich danach wieder verknüpfen. Diese Aktion kann nicht rückgängig gemacht werden."
            : "Alle vorhandenen Daten werden durch den Import überschrieben. Diese Aktion kann nicht rückgängig gemacht werden."
        }
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
