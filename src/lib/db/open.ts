import { type DBSchema, type IDBPDatabase, type OpenDBCallbacks, openDB } from "idb";

export type DBOpenerOptions<S extends DBSchema | unknown> = {
  /** Unique per app: in local dev every app shares the localhost origin. */
  name: string;
  /** Bump with every schema change, together with a new `if (oldVersion < N)` step. */
  version: number;
  upgrade: OpenDBCallbacks<S>["upgrade"];
  /**
   * Another tab opened a newer schema version. This connection is already closed
   * when it runs, so that tab's upgrade can proceed.
   * Default: reload, so this tab runs code that matches the new schema.
   */
  onVersionChange?: () => void;
};

/**
 * A `getDB()` that opens the database once and hands every caller the same
 * connection — plus the lifecycle IndexedDB leaves to the app:
 *
 * - A newer version opened elsewhere: close this connection (or that tab's
 *   upgrade stays blocked forever), forget it, then `onVersionChange`.
 * - The browser dropped the connection (Safari does): forget it and reopen on
 *   the next call.
 * - The open failed (VersionError after a downgrade, quota, private mode):
 *   don't cache the rejection — the next call tries again.
 */
export function createDBOpener<S extends DBSchema | unknown>(
  o: DBOpenerOptions<S>,
): () => Promise<IDBPDatabase<S>> {
  let pending: Promise<IDBPDatabase<S>> | null = null;

  return () => {
    pending ??= openDB<S>(o.name, o.version, {
      upgrade: o.upgrade,
      blocked(currentVersion) {
        console.warn(
          `[db] ${o.name}: upgrade to v${o.version} waits for another tab still on v${currentVersion}`,
        );
      },
      blocking(_currentVersion, _blockedVersion, event) {
        (event.target as IDBDatabase).close();
        pending = null;
        (o.onVersionChange ?? reload)();
      },
      terminated() {
        pending = null;
      },
    }).catch((err: unknown) => {
      pending = null;
      throw err;
    });
    return pending;
  };
}

function reload(): void {
  if (typeof location !== "undefined") location.reload();
}
