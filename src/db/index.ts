import Dexie, { type EntityTable } from 'dexie';
import type * as S from './schema';

export const db = new Dexie('hausverwaltung') as Dexie & {
  properties: EntityTable<S.Property, 'id'>;
  units: EntityTable<S.Unit, 'id'>;
  tenants: EntityTable<S.Tenant, 'id'>;
  occupancies: EntityTable<S.Occupancy, 'id'>;
  costTypes: EntityTable<S.CostType, 'id'>;
  costs: EntityTable<S.Cost, 'id'>;
  costShares: EntityTable<S.CostShare, 'id'>;
  prepayments: EntityTable<S.Prepayment, 'id'>;
  meterTypes: EntityTable<S.MeterType, 'id'>;
  meters: EntityTable<S.Meter, 'id'>;
  meterReadings: EntityTable<S.MeterReading, 'id'>;
  supplierBills: EntityTable<S.SupplierBill, 'id'>;
  maintenanceItems: EntityTable<S.MaintenanceItem, 'id'>;
  payments: EntityTable<S.Payment, 'id'>;
  handoverProtocols: EntityTable<S.HandoverProtocol, 'id'>;
  settings: EntityTable<S.Setting, 'key'>;
  rentChanges: EntityTable<S.RentChange, 'id'>;
  depositEvents: EntityTable<S.DepositEvent, 'id'>;
  documents: EntityTable<S.AppDocument, 'id'>;
  tombstones: EntityTable<S.Tombstone, 'syncId'>;
};

db.version(1).stores({
  properties: '++id',
  units: '++id, propertyId',
  tenants: '++id, unitId',
  occupancies: '++id, [unitId+from], tenantId, unitId',
  costTypes: '++id',
  costs: '++id, [year+costTypeId], propertyId',
  costShares: '++id, [costId+occupancyId]',
  prepayments: '++id, [occupancyId+year]',
  meterTypes: '++id',
  meters: '++id, unitId, meterTypeId',
  meterReadings: '++id, [meterId+date]',
  supplierBills: '++id, [year+type], propertyId',
  maintenanceItems: '++id, unitId, date',
  payments: '++id, [occupancyId+month], month',
  handoverProtocols: '++id, occupancyId',
  settings: 'key',
});

db.version(2).stores({
  rentChanges: '++id, occupancyId',
  depositEvents: '++id, occupancyId',
  documents: '++id, [entityType+entityId]',
});

db.version(3).stores({
  costTypes: '++id, sortOrder',
});

/**
 * Version 4 – Multi-Device-Sync:
 *   - Jeder Record bekommt `syncId` (UUID) und `updatedAt` (epoch ms).
 *   - Neue Tabelle `tombstones` tracked Löschungen für den Sync-Layer.
 *
 * WONTFIX — Migration stempelt allen Bestandsrecords `Date.now()` als
 * `updatedAt` und vergibt frische `syncId`s. Edge-Case: wenn zwei Geräte
 * dasselbe JSON-Backup importiert haben und _danach_ unabhängig nach v4
 * migrieren, bekommen identische Inhalte auf jedem Gerät eine eigene
 * `syncId`. Beim ersten Pairing entsteht dann Union-Merge → jeder Record
 * doppelt. Eine echte Lösung bräuchte Content-Fingerprinting beim ersten
 * Sync (Hash-basierte Dedup) — größere Architektur-Änderung. Im normalen
 * Single-Backup-pro-Gerät-Workflow ist der Fall nicht erreichbar.
 */
const SYNCABLE_TABLES = [
  'properties',
  'units',
  'tenants',
  'occupancies',
  'costTypes',
  'costs',
  'costShares',
  'prepayments',
  'meterTypes',
  'meters',
  'meterReadings',
  'supplierBills',
  'maintenanceItems',
  'payments',
  'handoverProtocols',
  'settings',
  'rentChanges',
  'depositEvents',
  'documents',
] as const;

db.version(4)
  .stores({
    properties: '++id, syncId, updatedAt',
    units: '++id, propertyId, syncId, updatedAt',
    tenants: '++id, unitId, syncId, updatedAt',
    occupancies: '++id, [unitId+from], tenantId, unitId, syncId, updatedAt',
    costTypes: '++id, sortOrder, syncId, updatedAt',
    costs: '++id, [year+costTypeId], propertyId, syncId, updatedAt',
    costShares: '++id, [costId+occupancyId], syncId, updatedAt',
    prepayments: '++id, [occupancyId+year], syncId, updatedAt',
    meterTypes: '++id, syncId, updatedAt',
    meters: '++id, unitId, meterTypeId, syncId, updatedAt',
    meterReadings: '++id, [meterId+date], syncId, updatedAt',
    supplierBills: '++id, [year+type], propertyId, syncId, updatedAt',
    maintenanceItems: '++id, unitId, date, syncId, updatedAt',
    payments: '++id, [occupancyId+month], month, syncId, updatedAt',
    handoverProtocols: '++id, occupancyId, syncId, updatedAt',
    settings: 'key, syncId, updatedAt',
    rentChanges: '++id, occupancyId, syncId, updatedAt',
    depositEvents: '++id, occupancyId, syncId, updatedAt',
    documents: '++id, [entityType+entityId], syncId, updatedAt',
    tombstones: 'syncId, [tableName+deletedAt], deletedAt',
  })
  .upgrade(async (tx) => {
    const now = Date.now();
    for (const tableName of SYNCABLE_TABLES) {
      await tx
        .table(tableName)
        .toCollection()
        .modify((rec: { syncId?: string; updatedAt?: number }) => {
          if (!rec.syncId) rec.syncId = crypto.randomUUID();
          if (!rec.updatedAt) rec.updatedAt = now;
        });
    }
  });

/**
 * Version 5 – Unique-Constraint auf [unitId+from] für occupancies und
 * [occupancyId+month] für payments. Verhindert versehentliche Duplikate,
 * die zu Doppelabrechnung führen.
 *
 * Vor dem Index-Upgrade werden Duplikate dedupliziert (keep oldest by id).
 */
db.version(5)
  .stores({
    occupancies: '++id, &[unitId+from], tenantId, unitId, syncId, updatedAt',
    payments: '++id, &[occupancyId+month], month, syncId, updatedAt',
  })
  .upgrade(async (tx) => {
    type Occ = { id?: number; unitId: number; from: string };
    type Pay = { id?: number; occupancyId: number; month: string };

    const dedupe = async <T extends { id?: number }>(
      tableName: 'occupancies' | 'payments',
      keyFn: (rec: T) => string,
    ) => {
      const all = (await tx.table(tableName).toArray()) as T[];
      const seen = new Map<string, number>();
      const idsToDelete: number[] = [];
      for (const rec of all) {
        if (rec.id === undefined) continue;
        const key = keyFn(rec);
        const existing = seen.get(key);
        if (existing === undefined) {
          seen.set(key, rec.id);
        } else {
          idsToDelete.push(rec.id > existing ? rec.id : existing);
          seen.set(key, rec.id < existing ? rec.id : existing);
        }
      }
      if (idsToDelete.length > 0) {
        await tx.table(tableName).bulkDelete(idsToDelete);
      }
    };

    await dedupe<Occ>('occupancies', (r) => `${r.unitId}_${r.from}`);
    await dedupe<Pay>('payments', (r) => `${r.occupancyId}_${r.month}`);
  });

// Listener-Liste für lokale Schreibvorgänge. Wird vom Sync-Service abonniert,
// um bei Änderungen einen Push auszulösen.
const localWriteListeners = new Set<() => void>();

export function onLocalWrite(listener: () => void): () => void {
  localWriteListeners.add(listener);
  return () => localWriteListeners.delete(listener);
}

let suppressWriteEvents = 0;

/**
 * Unterdrückt Write-Events für die Dauer des Callbacks.
 * Wird vom Sync-Layer benutzt, damit ein `applySnapshot` keinen
 * neuen Push-Zyklus triggert.
 */
export async function withoutWriteEvents<T>(fn: () => Promise<T>): Promise<T> {
  suppressWriteEvents++;
  try {
    return await fn();
  } finally {
    suppressWriteEvents--;
  }
}

function notifyLocalWrite(): void {
  if (suppressWriteEvents > 0) return;
  for (const l of localWriteListeners) {
    try {
      l();
    } catch {
      // listener-Fehler nicht propagieren
    }
  }
}

// Hooks: set syncId + updatedAt automatisch, damit bestehender CRUD-Code unverändert bleibt.
for (const tableName of SYNCABLE_TABLES) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = db.table(tableName) as any;
  table.hook('creating', (_pk: unknown, obj: Record<string, unknown>) => {
    if (!obj.syncId) obj.syncId = crypto.randomUUID();
    // Beim Sync-Apply liefert der Snapshot bereits `updatedAt` aus der
    // Quelle — sonst würde das Last-Write-Wins-Argument verloren gehen.
    if (typeof obj.updatedAt !== 'number') obj.updatedAt = Date.now();
    queueMicrotask(notifyLocalWrite);
  });
  table.hook('updating', (mods: Record<string, unknown>) => {
    queueMicrotask(notifyLocalWrite);
    // Sync-interne Updates (z.B. beim Merge) setzen updatedAt selbst —
    // nur automatisch setzen, wenn nicht bereits im Patch enthalten.
    if (!('updatedAt' in mods)) {
      return { ...mods, updatedAt: Date.now() };
    }
    return mods;
  });
  table.hook('deleting', () => {
    queueMicrotask(notifyLocalWrite);
  });
}

export { SYNCABLE_TABLES };

/**
 * Löscht einen Record und legt gleichzeitig einen Tombstone an,
 * damit andere Geräte beim nächsten Sync von der Löschung erfahren.
 *
 * WICHTIG: Statt `db.xyz.delete(id)` immer diesen Helper verwenden,
 * sonst geht die Löschung beim Sync verloren.
 */
export async function deleteWithTombstone(
  tableName: (typeof SYNCABLE_TABLES)[number],
  id: number | string,
): Promise<void> {
  await db.transaction('rw', db.table(tableName), db.tombstones, async () => {
    const record = (await db.table(tableName).get(id)) as
      | { syncId?: string }
      | undefined;
    if (record?.syncId) {
      await db.tombstones.put({
        syncId: record.syncId,
        tableName,
        deletedAt: Date.now(),
      });
    }
    await db.table(tableName).delete(id);
  });
}

/**
 * Bulk-Variante von `deleteWithTombstone` – löscht mehrere Records
 * derselben Tabelle in einer Transaktion und legt Tombstones an.
 */
export async function bulkDeleteWithTombstones(
  tableName: (typeof SYNCABLE_TABLES)[number],
  ids: (number | string)[],
): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction('rw', db.table(tableName), db.tombstones, async () => {
    const records = (await db.table(tableName).bulkGet(ids)) as (
      | { syncId?: string }
      | undefined
    )[];
    const tombstones = records
      .filter((r): r is { syncId: string } => Boolean(r?.syncId))
      .map((r) => ({
        syncId: r.syncId,
        tableName,
        deletedAt: Date.now(),
      }));
    if (tombstones.length > 0) {
      await db.tombstones.bulkPut(tombstones);
    }
    await db.table(tableName).bulkDelete(ids);
  });
}

/**
 * Löscht alle Records einer Tabelle, die einer Where-Bedingung entsprechen.
 * Ersetzt `db.xyz.where(...).equals(...).delete()`.
 */
export async function deleteWhereWithTombstones(
  tableName: (typeof SYNCABLE_TABLES)[number],
  indexField: string,
  value: number | string,
): Promise<void> {
  await db.transaction('rw', db.table(tableName), db.tombstones, async () => {
    const records = (await db
      .table(tableName)
      .where(indexField)
      .equals(value)
      .toArray()) as { id?: number; syncId?: string }[];
    if (records.length === 0) return;
    const tombstones = records
      .filter((r): r is { id: number; syncId: string } =>
        Boolean(r.syncId && r.id !== undefined),
      )
      .map((r) => ({
        syncId: r.syncId,
        tableName,
        deletedAt: Date.now(),
      }));
    if (tombstones.length > 0) {
      await db.tombstones.bulkPut(tombstones);
    }
    await db
      .table(tableName)
      .bulkDelete(records.map((r) => r.id).filter((id): id is number => id !== undefined));
  });
}
