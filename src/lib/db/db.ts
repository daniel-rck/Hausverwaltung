import type { IDBPTransaction } from "idb";
import { createDBOpener } from "./open.ts";

/**
 * Die DB-Naht (web-base `storage`): Schema, Name, Version und Upgrade-Leiter.
 * Den Verbindungs-Lebenszyklus (ein Open pro Seite, Retry nach Fehlschlag,
 * Schließen bei neuerer Version in einem anderen Tab) liefert das owned
 * `open.ts` via `createDBOpener`.
 *
 * Öffnet bewusst dieselbe Datenbank (`hausverwaltung`) und Versionsnummer wie
 * der frühere Dexie-Layer (Dexie nutzt intern `version * 10`, daher v5 → 50),
 * damit Bestandsdaten ohne Kopie/Migration erhalten bleiben. Die Index-Namen
 * entsprechen exakt den Dexie-Index-Tokens (z. B. `[meterId+date]`), sodass
 * bestehende Stores unverändert weiterverwendet werden.
 */

const DB_NAME = "hausverwaltung";
const DB_VERSION = 51;

type IndexSpec = { name: string; keyPath: string | string[]; unique?: boolean };
type StoreSpec = {
  name: string;
  keyPath: string;
  autoIncrement: boolean;
  indexes: IndexSpec[];
};

const SYNC_IDX: IndexSpec[] = [
  { name: "syncId", keyPath: "syncId" },
  { name: "updatedAt", keyPath: "updatedAt" },
];

export const STORES: StoreSpec[] = [
  { name: "properties", keyPath: "id", autoIncrement: true, indexes: [...SYNC_IDX] },
  {
    name: "units",
    keyPath: "id",
    autoIncrement: true,
    indexes: [{ name: "propertyId", keyPath: "propertyId" }, ...SYNC_IDX],
  },
  {
    name: "tenants",
    keyPath: "id",
    autoIncrement: true,
    indexes: [{ name: "unitId", keyPath: "unitId" }, ...SYNC_IDX],
  },
  {
    name: "occupancies",
    keyPath: "id",
    autoIncrement: true,
    indexes: [
      { name: "[unitId+from]", keyPath: ["unitId", "from"], unique: true },
      { name: "tenantId", keyPath: "tenantId" },
      { name: "unitId", keyPath: "unitId" },
      ...SYNC_IDX,
    ],
  },
  {
    name: "costTypes",
    keyPath: "id",
    autoIncrement: true,
    indexes: [{ name: "sortOrder", keyPath: "sortOrder" }, ...SYNC_IDX],
  },
  {
    name: "costs",
    keyPath: "id",
    autoIncrement: true,
    indexes: [
      { name: "[year+costTypeId]", keyPath: ["year", "costTypeId"] },
      { name: "propertyId", keyPath: "propertyId" },
      ...SYNC_IDX,
    ],
  },
  {
    name: "costShares",
    keyPath: "id",
    autoIncrement: true,
    indexes: [{ name: "[costId+occupancyId]", keyPath: ["costId", "occupancyId"] }, ...SYNC_IDX],
  },
  {
    name: "prepayments",
    keyPath: "id",
    autoIncrement: true,
    indexes: [{ name: "[occupancyId+year]", keyPath: ["occupancyId", "year"] }, ...SYNC_IDX],
  },
  { name: "meterTypes", keyPath: "id", autoIncrement: true, indexes: [...SYNC_IDX] },
  {
    name: "meters",
    keyPath: "id",
    autoIncrement: true,
    indexes: [
      { name: "unitId", keyPath: "unitId" },
      { name: "meterTypeId", keyPath: "meterTypeId" },
      ...SYNC_IDX,
    ],
  },
  {
    name: "meterReadings",
    keyPath: "id",
    autoIncrement: true,
    indexes: [{ name: "[meterId+date]", keyPath: ["meterId", "date"] }, ...SYNC_IDX],
  },
  {
    name: "supplierBills",
    keyPath: "id",
    autoIncrement: true,
    indexes: [
      { name: "[year+type]", keyPath: ["year", "type"] },
      { name: "propertyId", keyPath: "propertyId" },
      ...SYNC_IDX,
    ],
  },
  {
    name: "heatingStatements",
    keyPath: "id",
    autoIncrement: true,
    indexes: [
      // Bewusst nicht unique: legen zwei Geräte dasselbe Jahr an, muss der
      // Sync-Apply beide Records einfügen können (vgl. occupancies-Dedupe).
      { name: "[propertyId+year]", keyPath: ["propertyId", "year"] },
      { name: "propertyId", keyPath: "propertyId" },
      ...SYNC_IDX,
    ],
  },
  {
    name: "maintenanceItems",
    keyPath: "id",
    autoIncrement: true,
    indexes: [
      { name: "unitId", keyPath: "unitId" },
      { name: "date", keyPath: "date" },
      ...SYNC_IDX,
    ],
  },
  {
    name: "payments",
    keyPath: "id",
    autoIncrement: true,
    indexes: [
      { name: "[occupancyId+month]", keyPath: ["occupancyId", "month"], unique: true },
      { name: "month", keyPath: "month" },
      ...SYNC_IDX,
    ],
  },
  {
    name: "handoverProtocols",
    keyPath: "id",
    autoIncrement: true,
    indexes: [{ name: "occupancyId", keyPath: "occupancyId" }, ...SYNC_IDX],
  },
  { name: "settings", keyPath: "key", autoIncrement: false, indexes: [...SYNC_IDX] },
  {
    name: "rentChanges",
    keyPath: "id",
    autoIncrement: true,
    indexes: [{ name: "occupancyId", keyPath: "occupancyId" }, ...SYNC_IDX],
  },
  {
    name: "depositEvents",
    keyPath: "id",
    autoIncrement: true,
    indexes: [{ name: "occupancyId", keyPath: "occupancyId" }, ...SYNC_IDX],
  },
  {
    name: "documents",
    keyPath: "id",
    autoIncrement: true,
    indexes: [{ name: "[entityType+entityId]", keyPath: ["entityType", "entityId"] }, ...SYNC_IDX],
  },
  {
    name: "tombstones",
    keyPath: "syncId",
    autoIncrement: false,
    indexes: [
      { name: "[tableName+deletedAt]", keyPath: ["tableName", "deletedAt"] },
      { name: "deletedAt", keyPath: "deletedAt" },
    ],
  },
];

/** Stores, die Sync-Felder (syncId/updatedAt) automatisch gestempelt bekommen. */
const NON_SYNCABLE = new Set(["tombstones"]);
export function isSyncable(store: string): boolean {
  return !NON_SYNCABLE.has(store);
}

// oxlint-disable-next-line typescript/no-explicit-any -- the idb versionchange transaction is generic over the schema
type UpgradeTx = IDBPTransaction<unknown, any, "versionchange">;

async function dedupeUnique(
  tx: UpgradeTx,
  storeName: string,
  keyFn: (rec: Record<string, unknown>) => string,
): Promise<void> {
  const store = tx.objectStore(storeName);
  const all = (await store.getAll()) as Record<string, unknown>[];
  const seen = new Map<string, number>();
  const toDelete: number[] = [];
  for (const rec of all) {
    const id = rec.id as number | undefined;
    if (id === undefined) continue;
    const key = keyFn(rec);
    const existing = seen.get(key);
    if (existing === undefined) {
      seen.set(key, id);
    } else {
      toDelete.push(Math.max(id, existing));
      seen.set(key, Math.min(id, existing));
    }
  }
  for (const id of toDelete) await store.delete(id);
}

/**
 * Die Verbindung. Die Upgrade-Leiter gleicht deklarativ gegen `STORES` ab
 * (fehlende Stores/Indizes anlegen, Unique-Indizes nach Dedupe neu bauen),
 * statt `if (oldVersion < N)`-Stufen zu stapeln — so übernimmt sie
 * Dexie-Bestände jeder Version. Name und Version nie ändern: ein neuer Name
 * startet jeden Nutzer mit einer leeren Datenbank.
 */
export const getDB = createDBOpener<unknown>({
  name: DB_NAME,
  version: DB_VERSION,
  async upgrade(db, oldVersion, _newVersion, tx) {
    for (const spec of STORES) {
      const exists = db.objectStoreNames.contains(spec.name);
      const store = exists
        ? tx.objectStore(spec.name)
        : db.createObjectStore(spec.name, {
            keyPath: spec.keyPath,
            autoIncrement: spec.autoIncrement,
          });

      for (const idx of spec.indexes) {
        if (store.indexNames.contains(idx.name)) {
          // Vorhandenen Index nur neu anlegen, wenn sich Unique-Constraint
          // ändert (Upgrade von älterem Schema mit nicht-uniquem Index).
          if (idx.unique) {
            store.deleteIndex(idx.name);
          } else {
            continue;
          }
        }
        if (idx.unique && exists) {
          // Vor dem Unique-Index Duplikate entfernen (sonst schlägt die
          // Index-Erstellung fehl). Betrifft nur Upgrades von Pre-v5-Daten.
          if (spec.name === "occupancies") {
            await dedupeUnique(tx, "occupancies", (r) => `${r.unitId}_${r.from}`);
          } else if (spec.name === "payments") {
            await dedupeUnique(tx, "payments", (r) => `${r.occupancyId}_${r.month}`);
          }
        }
        store.createIndex(idx.name, idx.keyPath, idx.unique ? { unique: true } : undefined);
      }
    }

    // Pre-Sync-Daten (Dexie < v4): jedem Record syncId/updatedAt stempeln.
    if (oldVersion > 0 && oldVersion < 40) {
      const now = Date.now();
      for (const spec of STORES) {
        if (!isSyncable(spec.name)) continue;
        const store = tx.objectStore(spec.name);
        let cursor = await store.openCursor();
        while (cursor) {
          const rec = cursor.value as Record<string, unknown>;
          let changed = false;
          if (!rec.syncId) {
            rec.syncId = crypto.randomUUID();
            changed = true;
          }
          if (typeof rec.updatedAt !== "number") {
            rec.updatedAt = now;
            changed = true;
          }
          if (changed) await cursor.update(rec);
          cursor = await cursor.continue();
        }
      }
    }
  },
});
