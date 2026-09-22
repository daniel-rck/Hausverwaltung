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
import { Button, FormField, Input, useConfirm, useToast } from "../../lib/ui/ui";
import { Download, LinkIcon, Upload } from "../../lib/ui/ui/icons";
import { todayIso } from "../../lib/utils/dates";

export function ExportImport() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const syncState = useSyncStatus();
  const syncActive = syncState.status !== "disconnected";

  const handleExport = async () => {
    try {
      const json = await exportDatabase();
      const date = todayIso();
      downloadJson(json, `hausverwaltung-backup-${date}.json`);
      toast.success("Backup erfolgreich heruntergeladen.");
    } catch (err) {
      toast.error("Export fehlgeschlagen.");
      console.error(err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let text: string;
    try {
      text = await file.text();
      JSON.parse(text); // Validate JSON
    } catch {
      toast.error("Ungültige JSON-Datei.");
      e.target.value = "";
      return;
    }
    e.target.value = "";

    const ok = await confirm({
      title: "Daten importieren?",
      message: syncActive
        ? "Alle vorhandenen Daten werden durch den Import überschrieben und der Multi-Device-Sync wird zurückgesetzt — sonst würden die alten Backup-Daten auf alle verknüpften Geräte gepusht. Du kannst dich danach wieder verknüpfen. Diese Aktion kann nicht rückgängig gemacht werden."
        : "Alle vorhandenen Daten werden durch den Import überschrieben. Diese Aktion kann nicht rückgängig gemacht werden.",
      confirmLabel: "Importieren",
      danger: true,
    });
    if (!ok) return;
    await runImport(text);
  };

  const runImport = async (pendingFile: string) => {
    setImporting(true);

    try {
      // Sync VOR dem Import abklemmen, sonst pusht der Debounce-Timer
      // den (potenziell alten) Backup-Stand hoch und überschreibt damit
      // den Datenbestand auf allen verknüpften Geräten.
      if (syncService.getState().status !== "disconnected") {
        await syncService.disconnect();
      }
      await importDatabase(pendingFile);
      toast.success("Daten erfolgreich importiert. Seite wird neu geladen …");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
      toast.error(
        "Import fehlgeschlagen. Bitte prüfen Sie, ob die Datei ein gültiger Hausverwaltung-Export ist.",
      );
    } finally {
      setImporting(false);
    }
  };

  const handleShareUrl = async () => {
    try {
      const url = await exportAsUrl();
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      toast.success("Transfer-Link in Zwischenablage kopiert.");
    } catch (err) {
      console.error(err);
      toast.error(
        "Link-Erstellung fehlgeschlagen. Bei großen Datenmengen bitte den JSON-Export verwenden.",
      );
    }
  };

  return (
    <Card title="Daten-Backup">
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          className="flex-1"
          leftIcon={<Download size={14} />}
          onClick={() => void handleExport()}
        >
          Export (JSON)
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          leftIcon={<Upload size={14} />}
          onClick={() => fileInput.current?.click()}
          disabled={importing}
          loading={importing}
        >
          {importing ? "Importiert …" : "Import (JSON)"}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          onChange={(e) => void handleFileSelect(e)}
          className="hidden"
          aria-label="Backup-Datei auswählen"
          tabIndex={-1}
        />
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <Button
          variant="secondary"
          fullWidth
          leftIcon={<LinkIcon size={14} />}
          onClick={() => void handleShareUrl()}
        >
          Transfer-Link erstellen (zum Teilen per URL)
        </Button>
        {shareUrl && (
          <div className="mt-2">
            <FormField
              label="Transfer-Link"
              description="Link auf dem anderen Gerät im Browser öffnen, um die Daten zu importieren."
            >
              <Input
                readOnly
                value={shareUrl}
                className="text-xs font-mono"
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
              />
            </FormField>
          </div>
        )}
      </div>
    </Card>
  );
}
