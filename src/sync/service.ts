import { db, onLocalWrite, withoutWriteEvents } from '../db';
import { applySnapshot, buildLocalSnapshot, type SyncSnapshot } from './snapshot';
import { mergeSnapshots, snapshotSignature } from './merge';
import {
  claimPairing,
  createPairing,
  disable,
  downloadSyncFile,
  enableAsOwner,
  EtagConflictError,
  getSyncId,
  isEnabled,
  uploadSyncFile,
  type PairingTicket,
} from './cf-client';

export type SyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'syncing'
  | 'idle'
  | 'error'
  | 'offline';

export interface SyncState {
  status: SyncStatus;
  syncId: string | null;
  lastSyncedAt: number | null;
  lastError: string | null;
  autoSync: boolean;
}

type Listener = (state: SyncState) => void;

const DEBOUNCE_WRITE_MS = 2_000;
const LS_ETAG_KEY = 'hv-sync-etag';
const LS_LAST_SYNC_KEY = 'hv-sync-last';
const LS_SIGNATURE_KEY = 'hv-sync-sig';
const LS_AUTO_KEY = 'hv-sync-auto';
// Tombstones, die älter als das TTL sind, werden nach erfolgreichem Push
// gelöscht — sie haben ihren Zweck erfüllt und blähen sonst den Snapshot.
const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 Tage

class SyncService {
  private state: SyncState = {
    status: 'disconnected',
    syncId: null,
    lastSyncedAt: null,
    lastError: null,
    autoSync: true,
  };
  private listeners = new Set<Listener>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private dirty = false;
  private initialized = false;

  getState(): SyncState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /**
   * Wird beim App-Start einmal aufgerufen. Lädt den Sync-Zustand aus
   * localStorage, prüft auf bestehende Sync-Aktivierung und löst die
   * initiale Sync-Runde aus (Pull + Merge + ggf. Push).
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const storedAuto = localStorage.getItem(LS_AUTO_KEY);
    this.state.autoSync = storedAuto !== 'false';
    const storedLast = Number(localStorage.getItem(LS_LAST_SYNC_KEY) ?? 0);
    this.state.lastSyncedAt = Number.isFinite(storedLast) && storedLast > 0 ? storedLast : null;

    if (!isEnabled()) {
      this.setState({ status: 'disconnected' });
      return;
    }

    this.setState({
      status: 'idle',
      syncId: getSyncId(),
    });
    this.hookDbWrites();
    // Initiale Sync-Runde nach App-Start: Remote-Stand einholen.
    void this.runSync();
  }

  async connect(): Promise<void> {
    this.setState({ status: 'connecting', lastError: null });
    try {
      const { id } = await enableAsOwner();
      this.setState({
        status: 'idle',
        syncId: id,
        lastError: null,
      });
      this.hookDbWrites();
      await this.runSync();
    } catch (err) {
      this.setState({
        status: 'error',
        lastError: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.clearTimers();
    if (this.writeUnsubscribe) {
      this.writeUnsubscribe();
      this.writeUnsubscribe = null;
    }
    this.dirty = false;
    disable();
    localStorage.removeItem(LS_ETAG_KEY);
    localStorage.removeItem(LS_SIGNATURE_KEY);
    localStorage.removeItem(LS_LAST_SYNC_KEY);
    this.setState({
      status: 'disconnected',
      syncId: null,
      lastSyncedAt: null,
      lastError: null,
    });
  }

  async createPairing(): Promise<PairingTicket> {
    return createPairing();
  }

  async claimPairing(otp: string): Promise<void> {
    this.setState({ status: 'connecting', lastError: null });
    try {
      const { id } = await claimPairing(otp);
      // Bestehender ETag/Signature/lastSyncedAt gehört zu einem anderen
      // Namespace — verwerfen, damit das erste Sync den Remote-Stand korrekt
      // einholt und die UI keinen veralteten Sync-Zeitstempel anzeigt.
      localStorage.removeItem(LS_ETAG_KEY);
      localStorage.removeItem(LS_SIGNATURE_KEY);
      localStorage.removeItem(LS_LAST_SYNC_KEY);
      this.setState({
        status: 'idle',
        syncId: id,
        lastSyncedAt: null,
        lastError: null,
      });
      this.hookDbWrites();
      await this.runSync();
    } catch (err) {
      this.setState({
        status: 'error',
        lastError: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  setAutoSync(enabled: boolean): void {
    this.setState({ autoSync: enabled });
    localStorage.setItem(LS_AUTO_KEY, String(enabled));
    if (!enabled) {
      this.clearTimers();
    }
  }

  /**
   * Manuell ausgelöster Sync (z.B. "Jetzt synchronisieren"-Button).
   */
  async syncNow(): Promise<void> {
    await this.runSync();
  }

  /**
   * Hauptalgorithmus: Download → Merge → Apply → Upload (wenn nötig).
   * Idempotent und serialisiert (parallele Aufrufe warten).
   */
  private async runSync(): Promise<void> {
    if (this.isRunning) return;
    if (this.state.status === 'disconnected') return;
    if (!navigator.onLine) {
      this.setState({ status: 'offline' });
      return;
    }

    this.isRunning = true;
    // Dirty-Flag VOR dem Sync zurücksetzen, damit Writes, die während
    // des Push-Vorgangs eintrudeln, das Flag wieder auf true setzen
    // und im finally erkannt werden.
    this.dirty = false;
    this.setState({ status: 'syncing', lastError: null });

    try {
      await this.syncOnce();
      this.setState({
        status: 'idle',
        lastSyncedAt: Date.now(),
      });
      localStorage.setItem(LS_LAST_SYNC_KEY, String(this.state.lastSyncedAt));
    } catch (err) {
      if (err instanceof EtagConflictError) {
        // Noch einen Versuch: Remote hat sich geändert
        try {
          await this.syncOnce();
          this.setState({
            status: 'idle',
            lastSyncedAt: Date.now(),
          });
          localStorage.setItem(LS_LAST_SYNC_KEY, String(this.state.lastSyncedAt));
        } catch (retryErr) {
          this.dirty = true;
          this.setState({
            status: 'error',
            lastError: retryErr instanceof Error ? retryErr.message : String(retryErr),
          });
        }
      } else {
        this.dirty = true;
        const isNetwork =
          err instanceof TypeError && /fetch|network/i.test(err.message);
        this.setState({
          status: isNetwork ? 'offline' : 'error',
          lastError: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      this.isRunning = false;
      // Wenn während des Syncs lokal geschrieben wurde, setzt der Hook
      // dirty wieder auf true — dann brauchen wir noch eine Runde.
      // `syncId === null` heißt disconnect() hat zugeschlagen, nichts mehr tun.
      if (this.dirty && this.state.autoSync && this.state.syncId !== null) {
        this.scheduleDebouncedPush();
      }
    }
  }

  private async syncOnce(): Promise<void> {
    const prevEtag = localStorage.getItem(LS_ETAG_KEY) ?? undefined;
    const remote = await downloadSyncFile(prevEtag);

    const localSnapshot = await buildLocalSnapshot();

    let mergedFromRemote = false;
    let merged: SyncSnapshot = localSnapshot;
    let remoteEtag = prevEtag;

    if (remote === null) {
      // Keine Remote-Datei — nur pushen, keine Merge nötig
    } else if (remote === 'not-modified') {
      // Remote unverändert — nur lokalen Dirty-Zustand pushen, wenn nötig
    } else {
      remoteEtag = remote.etag;
      const remoteSnap = JSON.parse(remote.content) as SyncSnapshot;
      merged = mergeSnapshots(localSnapshot, remoteSnap);
      mergedFromRemote = true;
    }

    if (mergedFromRemote) {
      await withoutWriteEvents(() => applySnapshot(merged));
    }

    // Nach Apply neu bauen, damit lokale IDs konsistent sind
    const finalSnap = mergedFromRemote ? await buildLocalSnapshot() : localSnapshot;
    finalSnap.exportedAt = Date.now();

    const newSig = snapshotSignature(finalSnap);
    const prevSig = localStorage.getItem(LS_SIGNATURE_KEY);
    const needsPush =
      this.dirty ||
      mergedFromRemote ||
      remote === null ||
      newSig !== prevSig;

    if (needsPush) {
      const newEtag = await uploadSyncFile(
        JSON.stringify(finalSnap),
        remoteEtag,
      );
      localStorage.setItem(LS_ETAG_KEY, newEtag);
      localStorage.setItem(LS_SIGNATURE_KEY, newSig);
      await this.cleanupOldTombstones();
    } else if (remote && remote !== 'not-modified') {
      localStorage.setItem(LS_ETAG_KEY, remote.etag);
    }
  }

  private async cleanupOldTombstones(): Promise<void> {
    const cutoff = Date.now() - TOMBSTONE_TTL_MS;
    try {
      await withoutWriteEvents(async () => {
        await db.tombstones.where('deletedAt').below(cutoff).delete();
      });
    } catch {
      // Cleanup ist best-effort, bei Fehler nicht stören
    }
  }

  private writeUnsubscribe: (() => void) | null = null;

  /**
   * Registriert sich auf Dexie-Writes, damit lokale Änderungen ein verzögertes
   * Push auslösen, ohne jeden Tastendruck sofort hochzuladen.
   */
  private hookDbWrites(): void {
    if (this.writeUnsubscribe) return;
    this.writeUnsubscribe = onLocalWrite(() => {
      this.dirty = true;
      this.scheduleDebouncedPush();
    });
  }

  private scheduleDebouncedPush(): void {
    if (!this.state.autoSync) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.runSync();
    }, DEBOUNCE_WRITE_MS);
  }

  private clearTimers(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private setState(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }
}

export const syncService = new SyncService();

// Online-Event als zusätzlicher Trigger: pending Pushes nach einer
// Offline-Phase nachholen, sobald die Verbindung wieder steht.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (syncService.getState().status !== 'disconnected') {
      void syncService.syncNow();
    }
  });
}
