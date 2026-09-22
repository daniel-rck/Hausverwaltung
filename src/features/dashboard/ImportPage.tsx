import { Inflate } from "pako";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { importDatabase } from "../../lib/db/export-import";
import { syncService } from "../../lib/sync/service";
import { useSyncStatus } from "../../lib/sync/useSyncStatus";
import { Card } from "../../lib/ui/shared/Card";
import { Button, Callout, Skeleton } from "../../lib/ui/ui";

const MAX_PAYLOAD_BASE64 = 512 * 1024; // 512 KB komprimiert via URL
const MAX_DECOMPRESSED_BYTES = 20 * 1024 * 1024; // 20 MB JSON-Limit gegen ZIP-Bomben

/** Fehler mit bereits nutzerfreundlicher (deutscher) Meldung. */
class PayloadError extends Error {}

function safeInflateToString(binary: Uint8Array): string {
  const inflator = new Inflate({ to: "string" });
  let totalLen = 0;
  let result = "";
  inflator.onData = (chunk) => {
    const text = chunk as unknown as string;
    totalLen += text.length;
    if (totalLen > MAX_DECOMPRESSED_BYTES) {
      throw new PayloadError(
        `Import-Daten überschreiten ${Math.round(MAX_DECOMPRESSED_BYTES / 1024 / 1024)} MB Grenze.`,
      );
    }
    result += text;
  };
  inflator.push(binary, true);
  if (inflator.err) {
    console.error("Inflate failed:", inflator.msg);
    throw new PayloadError("Import-Link ist beschädigt (Dekompression fehlgeschlagen).");
  }
  return result;
}

type ParsedPayload = { ok: true; jsonData: string } | { ok: false; error: string };

function parsePayload(payload: string | undefined): ParsedPayload {
  if (!payload) {
    return { ok: false, error: "Kein Import-Payload in der URL gefunden." };
  }
  try {
    if (payload.length > MAX_PAYLOAD_BASE64) {
      throw new PayloadError("Import-Link ist zu groß. Bitte JSON-Datei verwenden.");
    }
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const decompressed = safeInflateToString(binary);
    const parsed = JSON.parse(decompressed);
    if (parsed.app !== "hausverwaltung") {
      throw new PayloadError("Ungültige Daten: Kein Hausverwaltung-Export.");
    }
    return { ok: true, jsonData: decompressed };
  } catch (err) {
    if (!(err instanceof PayloadError)) console.error(err);
    return {
      ok: false,
      error:
        err instanceof PayloadError
          ? err.message
          : "Import-Daten konnten nicht gelesen werden. Ist der Link vollständig?",
    };
  }
}

type Phase = "confirm" | "importing" | "success" | "error";

export function ImportPage() {
  const { payload } = useParams<{ payload: string }>();
  const navigate = useNavigate();
  const parsed = useMemo(() => parsePayload(payload), [payload]);

  const [phase, setPhase] = useState<Phase | null>(null);
  const [importError, setImportError] = useState("");
  const syncState = useSyncStatus();
  const syncActive = syncState.status !== "disconnected";

  const status: Phase = phase ?? (parsed.ok ? "confirm" : "error");
  const error = phase === "error" ? importError : parsed.ok ? "" : parsed.error;

  const handleImport = async () => {
    if (!parsed.ok) return;
    setPhase("importing");
    try {
      // Sync VOR dem Import abklemmen, sonst pusht der Debounce-Timer
      // den (potenziell alten) Backup-Stand hoch und überschreibt damit
      // den Datenbestand auf allen verknüpften Geräten.
      if (syncService.getState().status !== "disconnected") {
        await syncService.disconnect();
      }
      await importDatabase(parsed.jsonData);
      setPhase("success");
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      console.error(err);
      setImportError(
        "Import fehlgeschlagen. Bitte prüfen Sie, ob der Link einen gültigen Hausverwaltung-Export enthält.",
      );
      setPhase("error");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card title="Daten importieren">
        {status === "confirm" && (
          <div className="space-y-4">
            <p className="text-sm text-fg-muted">
              Es wurden Daten in der URL gefunden. Alle vorhandenen Daten werden durch den Import{" "}
              <strong>überschrieben</strong>.
              {syncActive && (
                <>
                  {" "}
                  Der Multi-Device-Sync wird dabei zurückgesetzt — sonst würden die importierten
                  Daten auf alle verknüpften Geräte gepusht. Du kannst dich danach wieder
                  verknüpfen.
                </>
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => void handleImport()}>
                Jetzt importieren
              </Button>
              <Button variant="secondary" onClick={() => navigate("/")}>
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {status === "importing" && (
          <div className="space-y-2">
            <p className="text-sm text-fg-muted">Import läuft …</p>
            <Skeleton variant="text" width="60%" />
          </div>
        )}

        {status === "success" && (
          <Callout variant="success" title="Daten erfolgreich importiert.">
            Sie werden weitergeleitet …
          </Callout>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <Callout variant="danger" title="Import nicht möglich">
              {error}
            </Callout>
            <Button variant="secondary" onClick={() => navigate("/")}>
              Zur Übersicht
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
