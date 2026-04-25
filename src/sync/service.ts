import { db, onLocalWrite, withoutWriteEvents } from '../db';
import { applySnapshot, buildLocalSnapshot, type SyncSnapshot } from './snapshot';
import { mergeSnapshots, snapshotSignature } from './merge';
import {
  downloadSyncFile,
  EtagConflictError,
  getActiveAccount,
  isOneDriveConfigured,
  signIn,
  signOut,
  uploadSyncFile,
} from './onedrive-client';

export type SyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'syncing'
  | 'idle'
  | 'error'
  | 'offline';

export interface SyncState {
  status: SyncStatus;
  accountEmail: string | null;
  lastSyncedAt: number | null;
  lastError: string | null;
  autoSync: boolean;
}

type Listener = (state: SyncState) => void;

const POLL_INTERVAL_MS = 20_000;
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
    accountEmail: null,
    lastSyncedAt: null,
    lastError: null,
    autoSync: true,
  };
  private listeners = new Set<Listener>();
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
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
   * Wird beim App-Start einmal aufgerufen. Lädt den Sync-Zustand aus localStorage,
   * prüft auf bestehende OneDrive-Session und startet ggf. den Poll-Loop.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const storedAuto = localStorage.getItem(LS_AUTO_KEY);
    this.state.autoSync = storedAuto !== 'false';
    const storedLast = Number(localStorage.getItem(LS_LAST_SYNC_KEY) ?? 0);
    this.state.lastSyncedAt = Number.isFinite(storedLast) && storedLast > 0 ? storedLast : null;

    if (!isOneDriveConfigured()) {
      this.setState({ status: 'disconnected' });
      return;
    }

    try {
      const account = await getActiveAccount();
      if (account) {
        this.setState({
          status: 'idle',
          accountEmail: account.username,
        });
        this.hookDbWrites();
        this.schedulePoll();
        // Initiale Sync-Runde
        void this.runSync();
      } else {
        this.setState({ status: 'disconnected' });
      }
    } catch (err) {
      this.setState({
        status: 'error',
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async connect(): Promise<void> {
    this.setState({ status: 'connecting', lastError: null });
    try {
      const account = await signIn();
      this.setState({
        status: 'idle',
        accountEmail: account.username,
        lastError: null,
      });
      this.hookDbWrites();
      this.schedulePoll();
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
    this.clearPoll();
    try {
      await signOut();
    } catch {
      // best-effort
    }
    localStorage.removeItem(LS_ETAG_KEY);
    localStorage.removeItem(LS_SIGNATURE_KEY);
    localStorage.removeItem(LS_LAST_SYNC_KEY);
    this.setState({
      status: 'disconnected',
      accountEmail: null,
      lastSyncedAt: null,
      lastError: null,
    });
  }

  setAutoSync(enabled: boolean): void {
    this.setState({ autoSync: enabled });
    localStorage.setItem(LS_AUTO_KEY, String(enabled));
    if (enabled) {
      this.schedulePoll();
    } else {
      this.clearPoll();
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
          this.setState({
            status: 'error',
            lastError: retryErr instanceof Error ? retryErr.message : String(retryErr),
          });
        }
      } else {
        const isNetwork =
          err instanceof TypeError && /fetch|network/i.test(err.message);
        this.setState({
          status: isNetwork ? 'offline' : 'error',
          lastError: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      this.isRunning = false;
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
      this.dirty = false;
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

  private schedulePoll(): void {
    this.clearPoll();
    if (!this.state.autoSync) return;
    const tick = () => {
      this.pollTimer = setTimeout(async () => {
        await this.runSync();
        tick();
      }, POLL_INTERVAL_MS);
    };
    tick();
  }

  private clearPoll(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
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

// Tab-Fokus + online/offline als zusätzliche Trigger
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    if (syncService.getState().status !== 'disconnected') {
      void syncService.syncNow();
    }
  });
  window.addEventListener('online', () => {
    if (syncService.getState().status !== 'disconnected') {
      void syncService.syncNow();
    }
  });
  window.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'visible' &&
      syncService.getState().status !== 'disconnected'
    ) {
      void syncService.syncNow();
    }
  });
}
