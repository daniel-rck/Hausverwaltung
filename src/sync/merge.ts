import type { SyncSnapshot } from './snapshot';
import type { Tombstone } from '../db/schema';

/**
 * Merge zweier Snapshots nach Last-Write-Wins-Semantik:
 *  - Pro `syncId` gewinnt der Record mit höherem `updatedAt`.
 *  - Tombstones gewinnen, wenn ihr `deletedAt` >= `updatedAt` des Records ist.
 *  - Tombstones selbst werden per max(deletedAt) zusammengeführt.
 */
export function mergeSnapshots(
  local: SyncSnapshot,
  remote: SyncSnapshot,
): SyncSnapshot {
  // 1. Tombstones mergen
  const tombstoneMap = new Map<string, Tombstone>();
  for (const t of [...local.tombstones, ...remote.tombstones]) {
    const existing = tombstoneMap.get(t.syncId);
    if (!existing || t.deletedAt > existing.deletedAt) {
      tombstoneMap.set(t.syncId, t);
    }
  }

  // 2. Pro Tabelle: Records mergen, dann gegen Tombstones filtern
  const tableNames = new Set([
    ...Object.keys(local.tables),
    ...Object.keys(remote.tables),
  ]);

  const mergedTables: Record<string, Record<string, unknown>[]> = {};
  for (const tableName of tableNames) {
    const byId = new Map<string, Record<string, unknown>>();
    const localRows = local.tables[tableName] ?? [];
    const remoteRows = remote.tables[tableName] ?? [];

    for (const row of [...localRows, ...remoteRows]) {
      const syncId = row.syncId as string | undefined;
      if (!syncId) continue;
      const ts = tombstoneMap.get(syncId);
      const updatedAt = (row.updatedAt as number) ?? 0;
      if (ts && ts.deletedAt >= updatedAt) {
        continue; // Tombstone gewinnt
      }
      const existing = byId.get(syncId);
      if (!existing || updatedAt > ((existing.updatedAt as number) ?? 0)) {
        byId.set(syncId, row);
      }
    }

    mergedTables[tableName] = [...byId.values()];
  }

  return {
    version: 1,
    app: 'hausverwaltung',
    exportedAt: Date.now(),
    tables: mergedTables,
    tombstones: [...tombstoneMap.values()],
  };
}

/**
 * Vergleicht, ob zwei Snapshots inhaltlich gleich sind (für "nichts zu pushen").
 * Vergleicht nur die Records-Anzahl und max(updatedAt) pro Tabelle + Tombstones —
 * reicht als Heuristik, um unnötige Uploads zu vermeiden.
 */
export function snapshotSignature(snap: SyncSnapshot): string {
  const parts: string[] = [];
  for (const [name, rows] of Object.entries(snap.tables)) {
    const maxUpdated = rows.reduce(
      (m, r) => Math.max(m, (r.updatedAt as number) ?? 0),
      0,
    );
    parts.push(`${name}:${rows.length}:${maxUpdated}`);
  }
  const maxDel = snap.tombstones.reduce(
    (m, t) => Math.max(m, t.deletedAt),
    0,
  );
  parts.push(`ts:${snap.tombstones.length}:${maxDel}`);
  return parts.sort().join('|');
}
