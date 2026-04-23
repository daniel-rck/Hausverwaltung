import { db, SYNCABLE_TABLES } from '../db';
import type { Tombstone } from '../db/schema';
import { FK_MAP, resolveDynamicFkTarget } from './fk-map';

/**
 * Snapshot-Format für den Sync.
 *
 * Records werden NICHT mit ihren lokalen numerischen `id`s serialisiert —
 * stattdessen wird jeder Record durch seine `syncId` identifiziert, und
 * alle Fremdschlüssel (propertyId, unitId, ...) werden beim Export auf
 * die `syncId` des referenzierten Records umgeschrieben. Beim Import
 * laufen die Übersetzungen rückwärts.
 *
 * Damit kann jedes Gerät seine eigenen lokalen Auto-IDs vergeben,
 * ohne dass Sync kollidiert.
 */
export interface SyncSnapshot {
  version: 1;
  app: 'hausverwaltung';
  exportedAt: number;
  /** Pro Tabelle: Records mit FKs in syncId-Form, ohne lokale `id`-Felder. */
  tables: Record<string, Record<string, unknown>[]>;
  tombstones: Tombstone[];
}

type AnyRecord = Record<string, unknown>;

/**
 * Export: lokaler DB-Zustand → Snapshot mit syncId-basierten FKs.
 */
export async function buildLocalSnapshot(): Promise<SyncSnapshot> {
  const idToSyncId = await buildIdToSyncIdMap();

  const tables: Record<string, AnyRecord[]> = {};
  for (const tableName of SYNCABLE_TABLES) {
    const rows = (await db.table(tableName).toArray()) as AnyRecord[];
    tables[tableName] = rows.map((row) => translateRowToWire(tableName, row, idToSyncId));
  }

  const tombstones = (await db.tombstones.toArray()) as Tombstone[];

  return {
    version: 1,
    app: 'hausverwaltung',
    exportedAt: Date.now(),
    tables,
    tombstones,
  };
}

/**
 * Wendet einen Snapshot auf die lokale DB an – löscht vorher NICHT,
 * sondern upserted per `syncId`. Bestehende Records ohne Entsprechung
 * im Snapshot bleiben erhalten (wichtig für Merge-Semantik).
 *
 * Diese Funktion wird ausschließlich vom Merge-Layer aufgerufen,
 * nachdem dort schon ent­schieden wurde, was bleibt.
 */
export async function applySnapshot(snapshot: SyncSnapshot): Promise<void> {
  // Schritt 1: Tombstones anwenden (vor Records, damit wir nichts unnötig einfügen,
  // was gleich wieder gelöscht würde).
  await db.transaction('rw', db.tombstones, async () => {
    if (snapshot.tombstones.length > 0) {
      await db.tombstones.bulkPut(snapshot.tombstones);
    }
  });

  // Schritt 2: aktive Tombstones für Records im Snapshot sammeln
  //   (wird vom Merge bereits gefiltert, aber defensive Sicherung hier)
  const tombstoneSet = new Set(snapshot.tombstones.map((t) => t.syncId));

  // Schritt 3: pro Tabelle Records upserten + zwischengespeicherte syncId→localId-Map aufbauen
  // Reihenfolge muss respektieren, dass FK-Ziele vor Quellen verarbeitet werden.
  const order = topologicalOrder();
  const syncIdToLocalId = new Map<string, number>();

  // Seed: bereits vorhandene Records
  for (const tableName of SYNCABLE_TABLES) {
    const existing = (await db.table(tableName).toArray()) as AnyRecord[];
    for (const r of existing) {
      if (typeof r.syncId === 'string' && typeof r.id === 'number') {
        syncIdToLocalId.set(r.syncId, r.id);
      }
    }
  }

  for (const tableName of order) {
    const remoteRows = snapshot.tables[tableName] ?? [];

    await db.transaction('rw', db.table(tableName), async () => {
      for (const wire of remoteRows) {
        const syncId = wire.syncId as string;
        if (!syncId) continue;
        if (tombstoneSet.has(syncId)) {
          // Record ist gelöscht – falls lokal noch vorhanden, löschen
          const existing = (await db
            .table(tableName)
            .where('syncId')
            .equals(syncId)
            .first()) as AnyRecord | undefined;
          if (existing?.id !== undefined) {
            await db.table(tableName).delete(existing.id as number);
          }
          continue;
        }

        const localRecord = translateRowFromWire(tableName, wire, syncIdToLocalId);
        const existing = (await db
          .table(tableName)
          .where('syncId')
          .equals(syncId)
          .first()) as AnyRecord | undefined;

        if (existing?.id !== undefined) {
          // Update: lokale ID beibehalten
          (localRecord as { id?: number }).id = existing.id as number;
          await db.table(tableName).put(localRecord);
          syncIdToLocalId.set(syncId, existing.id as number);
        } else {
          // Insert: lokale Auto-ID wird vergeben
          const newId = (await db.table(tableName).add(localRecord)) as
            | number
            | string;
          if (typeof newId === 'number') {
            syncIdToLocalId.set(syncId, newId);
          }
        }
      }
    });
  }
}

/**
 * Baut eine Lookup-Map: pro Tabelle eine lokale id → syncId.
 * Genutzt, um beim Export FKs zu übersetzen.
 */
async function buildIdToSyncIdMap(): Promise<Record<string, Map<number, string>>> {
  const map: Record<string, Map<number, string>> = {};
  for (const tableName of SYNCABLE_TABLES) {
    const m = new Map<number, string>();
    const rows = (await db.table(tableName).toArray()) as AnyRecord[];
    for (const r of rows) {
      if (typeof r.id === 'number' && typeof r.syncId === 'string') {
        m.set(r.id, r.syncId);
      }
    }
    map[tableName] = m;
  }
  return map;
}

/**
 * Row → Wire-Format: entfernt `id`, übersetzt FK-Felder von numerischer ID auf syncId.
 */
function translateRowToWire(
  tableName: string,
  row: AnyRecord,
  idToSyncId: Record<string, Map<number, string>>,
): AnyRecord {
  const out: AnyRecord = { ...row };
  delete out.id;

  const fkFields = FK_MAP[tableName] ?? {};
  for (const [field, targetTable] of Object.entries(fkFields)) {
    const val = out[field];
    if (typeof val === 'number') {
      const syncId = idToSyncId[targetTable]?.get(val);
      if (syncId) {
        out[`${field}__sync`] = syncId;
        delete out[field];
      }
    }
  }

  // Dynamische FKs (z.B. documents.entityId)
  const dynamicTarget = resolveDynamicFkTarget(tableName, row);
  if (dynamicTarget && typeof row.entityId === 'number') {
    const syncId = idToSyncId[dynamicTarget]?.get(row.entityId);
    if (syncId) {
      out.entityId__sync = syncId;
      delete out.entityId;
    }
  }

  return out;
}

/**
 * Wire → lokales Row-Format: übersetzt `__sync`-FK-Felder zurück in numerische IDs.
 * Wenn die referenzierte Quelle (noch) nicht lokal existiert, bleibt das FK-Feld leer
 * und der Record wird trotzdem eingefügt (referenzielle Integrität wird beim nächsten
 * Sync-Durchlauf repariert, sobald auch das Ziel da ist).
 */
function translateRowFromWire(
  tableName: string,
  wire: AnyRecord,
  syncIdToLocalId: Map<string, number>,
): AnyRecord {
  const out: AnyRecord = { ...wire };

  const fkFields = FK_MAP[tableName] ?? {};
  for (const field of Object.keys(fkFields)) {
    const syncKey = `${field}__sync`;
    const syncVal = out[syncKey];
    if (typeof syncVal === 'string') {
      const localId = syncIdToLocalId.get(syncVal);
      if (localId !== undefined) {
        out[field] = localId;
      }
      delete out[syncKey];
    }
  }

  // Dynamische FKs zurückübersetzen
  if (tableName === 'documents' && typeof out.entityId__sync === 'string') {
    const localId = syncIdToLocalId.get(out.entityId__sync as string);
    if (localId !== undefined) {
      out.entityId = localId;
    }
    delete out.entityId__sync;
  }

  // `id` niemals übernehmen (wird lokal vergeben oder vom Upsert gesetzt)
  delete out.id;

  return out;
}

/**
 * Grobe Reihenfolge, in der Tabellen beim Apply verarbeitet werden,
 * damit FK-Ziele vor ihren Referenzen existieren.
 */
function topologicalOrder(): readonly string[] {
  return [
    'properties',
    'costTypes',
    'meterTypes',
    'units',
    'tenants',
    'meters',
    'occupancies',
    'costs',
    'maintenanceItems',
    'supplierBills',
    'costShares',
    'prepayments',
    'meterReadings',
    'payments',
    'handoverProtocols',
    'rentChanges',
    'depositEvents',
    'documents',
    'settings',
  ];
}
