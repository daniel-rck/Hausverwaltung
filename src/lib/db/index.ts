import { onLocalWrite, withoutWriteEvents } from "./idb";
import type * as S from "./schema";
import { Table } from "./table";

export { useLiveQuery } from "./useLiveQuery";
export { onLocalWrite, withoutWriteEvents };

type AnyTable = Table<Record<string, unknown>>;

/**
 * Zentrale DB-Fassade. Ersetzt den früheren Dexie-`db` durch einen
 * `idb`-gestützten Layer mit derselben Aufruf-API (Tabellen-Accessoren,
 * `where().equals()`, `transaction`, …). Siehe table.ts / idb.ts.
 */
class Database {
  readonly properties = new Table<S.Property>("properties", "id");
  readonly units = new Table<S.Unit>("units", "id");
  readonly tenants = new Table<S.Tenant>("tenants", "id");
  readonly occupancies = new Table<S.Occupancy>("occupancies", "id");
  readonly costTypes = new Table<S.CostType>("costTypes", "id");
  readonly costs = new Table<S.Cost>("costs", "id");
  readonly costShares = new Table<S.CostShare>("costShares", "id");
  readonly prepayments = new Table<S.Prepayment>("prepayments", "id");
  readonly meterTypes = new Table<S.MeterType>("meterTypes", "id");
  readonly meters = new Table<S.Meter>("meters", "id");
  readonly meterReadings = new Table<S.MeterReading>("meterReadings", "id");
  readonly supplierBills = new Table<S.SupplierBill>("supplierBills", "id");
  readonly maintenanceItems = new Table<S.MaintenanceItem>("maintenanceItems", "id");
  readonly payments = new Table<S.Payment>("payments", "id");
  readonly handoverProtocols = new Table<S.HandoverProtocol>("handoverProtocols", "id");
  readonly settings = new Table<S.Setting>("settings", "key");
  readonly rentChanges = new Table<S.RentChange>("rentChanges", "id");
  readonly depositEvents = new Table<S.DepositEvent>("depositEvents", "id");
  readonly documents = new Table<S.AppDocument>("documents", "id");
  readonly tombstones = new Table<S.Tombstone>("tombstones", "syncId");

  private readonly byName: Record<string, AnyTable>;

  constructor() {
    this.byName = {};
    for (const value of Object.values(this)) {
      if (value instanceof Table) this.byName[value.name] = value as AnyTable;
    }
  }

  table(name: string): AnyTable {
    const t = this.byName[name];
    if (!t) throw new Error(`Unknown table: ${name}`);
    return t;
  }

  get tables(): AnyTable[] {
    return Object.values(this.byName);
  }

  /**
   * Kompatibilitäts-Shim für `db.transaction(mode, ...tables, fn)`.
   * `idb`-Transaktionen können keine beliebigen `await`s überspannen; daher
   * werden die enthaltenen Operationen sequentiell (je eigene IDB-Transaktion)
   * ausgeführt. Der End-Zustand ist identisch; verloren geht nur das
   * Crash-Rollback – ein Trade-off, den die App bereits an anderer Stelle
   * bewusst eingeht (siehe cascade.ts).
   */
  async transaction<T>(_mode: string, ...args: unknown[]): Promise<T> {
    const fn = args[args.length - 1] as () => Promise<T>;
    return fn();
  }
}

export const db = new Database();

export const SYNCABLE_TABLES = [
  "properties",
  "units",
  "tenants",
  "occupancies",
  "costTypes",
  "costs",
  "costShares",
  "prepayments",
  "meterTypes",
  "meters",
  "meterReadings",
  "supplierBills",
  "maintenanceItems",
  "payments",
  "handoverProtocols",
  "settings",
  "rentChanges",
  "depositEvents",
  "documents",
] as const;

type SyncableTable = (typeof SYNCABLE_TABLES)[number];

/**
 * Löscht einen Record und legt einen Tombstone an, damit andere Geräte beim
 * nächsten Sync von der Löschung erfahren.
 *
 * WICHTIG: Statt `db.xyz.delete(id)` immer diesen Helper verwenden, sonst geht
 * die Löschung beim Sync verloren.
 */
export async function deleteWithTombstone(
  tableName: SyncableTable,
  id: number | string,
): Promise<void> {
  const record = (await db.table(tableName).get(id)) as { syncId?: string } | undefined;
  if (record?.syncId) {
    await db.tombstones.put({ syncId: record.syncId, tableName, deletedAt: Date.now() });
  }
  await db.table(tableName).delete(id);
}

/** Bulk-Variante von `deleteWithTombstone`. */
export async function bulkDeleteWithTombstones(
  tableName: SyncableTable,
  ids: (number | string)[],
): Promise<void> {
  if (ids.length === 0) return;
  const records = (await db.table(tableName).bulkGet(ids)) as ({ syncId?: string } | undefined)[];
  const tombstones = records
    .filter((r): r is { syncId: string } => Boolean(r?.syncId))
    .map((r) => ({ syncId: r.syncId, tableName, deletedAt: Date.now() }));
  if (tombstones.length > 0) {
    await db.tombstones.bulkPut(tombstones);
  }
  await db.table(tableName).bulkDelete(ids);
}

/**
 * Löscht alle Records einer Tabelle, die einer Where-Bedingung entsprechen.
 * Ersetzt `db.xyz.where(...).equals(...).delete()`.
 */
export async function deleteWhereWithTombstones(
  tableName: SyncableTable,
  indexField: string,
  value: number | string,
): Promise<void> {
  const records = (await db.table(tableName).where(indexField).equals(value).toArray()) as {
    id?: number;
    syncId?: string;
  }[];
  if (records.length === 0) return;
  const tombstones = records
    .filter((r): r is { id: number; syncId: string } => Boolean(r.syncId && r.id !== undefined))
    .map((r) => ({ syncId: r.syncId, tableName, deletedAt: Date.now() }));
  if (tombstones.length > 0) {
    await db.tombstones.bulkPut(tombstones);
  }
  await db
    .table(tableName)
    .bulkDelete(records.map((r) => r.id).filter((id): id is number => id !== undefined));
}
