import { useEffect, useState } from "react";
import { syncService } from "../../sync/service";
import { useSyncStatus } from "../../sync/useSyncStatus";
import { Card } from "../shared/Card";
import { Button } from "../ui/Button";

function formatAbsolute(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(msRemaining: number): string {
  const sec = Math.max(0, Math.floor(msRemaining / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Mode = "idle" | "showing-otp" | "entering-otp";

export function SyncSettings() {
  const state = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [pairing, setPairing] = useState<{ otp: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [otpInput, setOtpInput] = useState("");

  // While a pairing OTP is active: tick `now` every second for the countdown,
  // and schedule a one-shot timer to auto-clear exactly when the OTP expires.
  useEffect(() => {
    if (!pairing) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const remaining = pairing.expiresAt - Date.now();
    const expire = setTimeout(
      () => {
        setPairing(null);
        setMode("idle");
      },
      Math.max(0, remaining),
    );
    return () => {
      clearInterval(tick);
      clearTimeout(expire);
    };
  }, [pairing]);

  const handleEnable = async () => {
    setMessage(null);
    setBusy(true);
    try {
      await syncService.connect();
      setMessage({ type: "success", text: "Sync aktiviert." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Aktivierung fehlgeschlagen.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setMessage(null);
    setBusy(true);
    try {
      await syncService.disconnect();
      setPairing(null);
      setMode("idle");
      setMessage({ type: "success", text: "Sync zurückgesetzt." });
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

  const handleStartPairing = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const ticket = await syncService.createPairing();
      setPairing(ticket);
      setMode("showing-otp");
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Pairing fehlgeschlagen.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancelPairing = () => {
    setPairing(null);
    setMode("idle");
  };

  const handleClaim = async () => {
    setMessage(null);
    setBusy(true);
    try {
      await syncService.claimPairing(otpInput);
      setOtpInput("");
      setMode("idle");
      setMessage({ type: "success", text: "Mit anderem Gerät verknüpft." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Code ungültig oder abgelaufen.",
      });
    } finally {
      setBusy(false);
    }
  };

  const enabled = state.status !== "disconnected";

  return (
    <Card title="Multi-Device-Sync">
      <p className="text-sm text-fg-muted mb-4">
        Daten zwischen mehreren Geräten synchronisieren — verschlüsselt über deinen privaten
        Sync-Speicher. Kein Konto, keine E-Mail.
      </p>

      {!enabled && mode === "idle" && (
        <div className="space-y-2">
          <Button variant="primary" fullWidth onClick={handleEnable} loading={busy}>
            {busy ? "Aktiviere…" : "Sync aktivieren"}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setMode("entering-otp")}
            disabled={busy}
          >
            Mit anderem Gerät verknüpfen
          </Button>
          <p className="text-xs text-fg-muted mt-2">
            Beim Aktivieren wird dieses Gerät zum Sync-Owner. Weitere Geräte verknüpfst du
            anschließend über einen 6-stelligen Code.
          </p>
        </div>
      )}

      {!enabled && mode === "entering-otp" && (
        <div className="space-y-3">
          <div className="text-sm text-fg">Code vom anderen Gerät eingeben:</div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            ref={(el) => el?.focus()}
            maxLength={6}
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-border rounded-md bg-surface text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]/40 focus-visible:border-[--color-accent]"
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleClaim}
              loading={busy}
              disabled={otpInput.length !== 6}
            >
              {busy ? "Verknüpfe…" : "Verknüpfen"}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setMode("idle");
                setOtpInput("");
              }}
              disabled={busy}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {enabled && mode === "showing-otp" && pairing && (
        <div className="space-y-3">
          <div className="text-sm text-fg">
            Code am anderen Gerät eingeben (gültig {formatCountdown(pairing.expiresAt - now)}):
          </div>
          <div className="text-4xl sm:text-5xl text-center font-mono font-semibold tracking-[0.2em] py-6 bg-surface-muted/60 rounded-lg text-fg border border-border">
            {pairing.otp.slice(0, 3)} {pairing.otp.slice(3)}
          </div>
          <Button variant="secondary" fullWidth onClick={handleCancelPairing}>
            Abbrechen
          </Button>
          <p className="text-xs text-fg-muted">
            Der Code kann nur einmal verwendet werden und läuft nach 5 Minuten ab.
          </p>
        </div>
      )}

      {enabled && mode === "idle" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-fg-muted">
                Status: {state.status === "idle" && "synchronisiert"}
                {state.status === "syncing" && "synchronisiere…"}
                {state.status === "connecting" && "verbinde…"}
                {state.status === "offline" && "offline (Daten werden später synchronisiert)"}
                {state.status === "error" && `Fehler: ${state.lastError ?? "unbekannt"}`}
              </div>
              {state.lastSyncedAt && (
                <div className="text-xs text-fg-subtle mt-0.5">
                  Letzter Sync: {formatAbsolute(state.lastSyncedAt)}
                </div>
              )}
              {state.syncId && (
                <div className="text-xs text-fg-subtle mt-0.5 font-mono">
                  ID: {state.syncId.slice(0, 8)}…
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleSyncNow}
              disabled={busy || state.status === "syncing"}
            >
              Jetzt synchronisieren
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleStartPairing}
              disabled={busy}
            >
              Weiteres Gerät verknüpfen
            </Button>
            <Button variant="secondary" className="flex-1" onClick={handleDisable} disabled={busy}>
              Sync zurücksetzen
            </Button>
          </div>

          <label className="flex items-center gap-2 text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={state.autoSync}
              onChange={(e) => syncService.setAutoSync(e.target.checked)}
            />
            Automatisch bei Änderungen pushen
          </label>
        </div>
      )}

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
  );
}
