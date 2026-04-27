import { useEffect, useState } from 'react';
import { Card } from '../shared/Card';
import { useSyncStatus } from '../../sync/useSyncStatus';
import { syncService } from '../../sync/service';

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

function formatCountdown(msRemaining: number): string {
  const sec = Math.max(0, Math.floor(msRemaining / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type Mode = 'idle' | 'showing-otp' | 'entering-otp';

export function SyncSettings() {
  const state = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [pairing, setPairing] = useState<{ otp: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [otpInput, setOtpInput] = useState('');

  // While a pairing OTP is active: tick `now` every second for the countdown,
  // and schedule a one-shot timer to auto-clear exactly when the OTP expires.
  useEffect(() => {
    if (!pairing) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const remaining = pairing.expiresAt - Date.now();
    const expire = setTimeout(() => {
      setPairing(null);
      setMode('idle');
    }, Math.max(0, remaining));
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
      setMessage({ type: 'success', text: 'Sync aktiviert.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Aktivierung fehlgeschlagen.',
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
      setMode('idle');
      setMessage({ type: 'success', text: 'Sync zurückgesetzt.' });
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
      setMode('showing-otp');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Pairing fehlgeschlagen.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancelPairing = () => {
    setPairing(null);
    setMode('idle');
  };

  const handleClaim = async () => {
    setMessage(null);
    setBusy(true);
    try {
      await syncService.claimPairing(otpInput);
      setOtpInput('');
      setMode('idle');
      setMessage({ type: 'success', text: 'Mit anderem Gerät verknüpft.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Code ungültig oder abgelaufen.',
      });
    } finally {
      setBusy(false);
    }
  };

  const enabled = state.status !== 'disconnected';

  return (
    <Card title="Multi-Device-Sync">
      <p className="text-sm text-stone-600 dark:text-stone-300 mb-4">
        Daten zwischen mehreren Geräten synchronisieren — verschlüsselt über
        deinen privaten Sync-Speicher. Kein Konto, keine E-Mail.
      </p>

      {!enabled && mode === 'idle' && (
        <div className="space-y-2">
          <button
            onClick={handleEnable}
            disabled={busy}
            className="w-full px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors disabled:opacity-50"
          >
            {busy ? 'Aktiviere…' : 'Sync aktivieren'}
          </button>
          <button
            onClick={() => setMode('entering-otp')}
            disabled={busy}
            className="w-full px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            Mit anderem Gerät verknüpfen
          </button>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
            Beim Aktivieren wird dieses Gerät zum Sync-Owner. Weitere Geräte
            verknüpfst du anschließend über einen 6-stelligen Code.
          </p>
        </div>
      )}

      {!enabled && mode === 'entering-otp' && (
        <div className="space-y-3">
          <div className="text-sm text-stone-700 dark:text-stone-200">
            Code vom anderen Gerät eingeben:
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoFocus
            maxLength={6}
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100"
          />
          <div className="flex gap-2">
            <button
              onClick={handleClaim}
              disabled={busy || otpInput.length !== 6}
              className="flex-1 px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors disabled:opacity-50"
            >
              {busy ? 'Verknüpfe…' : 'Verknüpfen'}
            </button>
            <button
              onClick={() => {
                setMode('idle');
                setOtpInput('');
              }}
              disabled={busy}
              className="flex-1 px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {enabled && mode === 'showing-otp' && pairing && (
        <div className="space-y-3">
          <div className="text-sm text-stone-700 dark:text-stone-200">
            Code am anderen Gerät eingeben (gültig{' '}
            {formatCountdown(pairing.expiresAt - now)}):
          </div>
          <div className="text-4xl sm:text-5xl text-center font-mono font-semibold tracking-[0.2em] py-6 bg-stone-50 dark:bg-stone-700 rounded-lg text-stone-800 dark:text-stone-100">
            {pairing.otp.slice(0, 3)} {pairing.otp.slice(3)}
          </div>
          <button
            onClick={handleCancelPairing}
            className="w-full px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
          >
            Abbrechen
          </button>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Der Code kann nur einmal verwendet werden und läuft nach 5 Minuten ab.
          </p>
        </div>
      )}

      {enabled && mode === 'idle' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
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
              {state.syncId && (
                <div className="text-xs text-stone-400 dark:text-stone-500 mt-0.5 font-mono">
                  ID: {state.syncId.slice(0, 8)}…
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
              onClick={handleStartPairing}
              disabled={busy}
              className="flex-1 px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              Weiteres Gerät verknüpfen
            </button>
            <button
              onClick={handleDisable}
              disabled={busy}
              className="flex-1 px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              Sync zurücksetzen
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
