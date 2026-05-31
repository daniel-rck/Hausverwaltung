import { fireWrite, getDB, isSyncable } from "./idb";

/**
 * Schlanke, Dexie-kompatible Query-Oberfläche über `idb`. Stellt genau die im
 * Code genutzten Methoden bereit (`where().equals()/.between()/.below()`,
 * `orderBy`, `filter`, `toArray`, `first`, `count`, `add/put/update/delete`,
 * `bulk*`). Schreibende Operationen stempeln auf syncbaren Stores automatisch
 * `syncId`/`updatedAt` und feuern Mutations-Events (siehe idb.ts).
 */

type Rec = Record<string, unknown>;

function stampForWrite(store: string, obj: Rec): Rec {
  if (!isSyncable(store)) return obj;
  if (!obj.syncId) obj.syncId = crypto.randomUUID();
  if (typeof obj.updatedAt !== "number") obj.updatedAt = Date.now();
  return obj;
}

export class Collection<T> {
  private readonly table: Table<T>;
  private readonly resolver: () => Promise<T[]>;
  private readonly reversed: boolean;

  constructor(table: Table<T>, resolver: () => Promise<T[]>, reversed = false) {
    this.table = table;
    this.resolver = resolver;
    this.reversed = reversed;
  }

  async toArray(): Promise<T[]> {
    const rows = await this.resolver();
    return this.reversed ? rows.reverse() : rows;
  }

  async first(): Promise<T | undefined> {
    const rows = await this.toArray();
    return rows[0];
  }

  async count(): Promise<number> {
    return (await this.resolver()).length;
  }

  reverse(): Collection<T> {
    return new Collection<T>(this.table, this.resolver, !this.reversed);
  }

  filter(predicate: (row: T) => boolean): Collection<T> {
    return new Collection<T>(this.table, async () => (await this.resolver()).filter(predicate));
  }

  limit(n: number): Collection<T> {
    return new Collection<T>(this.table, async () => (await this.toArray()).slice(0, n));
  }

  async sortBy(key: string): Promise<T[]> {
    const rows = await this.toArray();
    return rows.sort((a, b) => {
      const av = (a as Rec)[key];
      const bv = (b as Rec)[key];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv);
      if (av === bv) return 0;
      return (av as number) < (bv as number) ? -1 : 1;
    });
  }

  /** Löscht alle getroffenen Records (per Primärschlüssel). */
  async delete(): Promise<number> {
    const rows = (await this.resolver()) as Rec[];
    if (rows.length === 0) return 0;
    await this.table.bulkDeleteRaw(rows.map((r) => r[this.table.keyPath] as IDBValidKey));
    return rows.length;
  }
}

export class WhereClause<T> {
  private readonly table: Table<T>;
  private readonly index: string;

  constructor(table: Table<T>, index: string) {
    this.table = table;
    this.index = index;
  }

  private collection(query: IDBValidKey | IDBKeyRange): Collection<T> {
    return new Collection<T>(this.table, () => this.table.getAllByIndex(this.index, query));
  }

  equals(value: IDBValidKey | IDBValidKey[]): Collection<T> {
    return this.collection(value as IDBValidKey);
  }

  between(
    lower: IDBValidKey | IDBValidKey[],
    upper: IDBValidKey | IDBValidKey[],
    includeLower = true,
    includeUpper = true,
  ): Collection<T> {
    return this.collection(
      IDBKeyRange.bound(lower as IDBValidKey, upper as IDBValidKey, !includeLower, !includeUpper),
    );
  }

  below(value: IDBValidKey): Collection<T> {
    return this.collection(IDBKeyRange.upperBound(value, true));
  }

  above(value: IDBValidKey): Collection<T> {
    return this.collection(IDBKeyRange.lowerBound(value, true));
  }
}

export class Table<T> {
  readonly name: string;
  readonly keyPath: string;

  constructor(name: string, keyPath: string) {
    this.name = name;
    this.keyPath = keyPath;
  }

  async get(key: IDBValidKey): Promise<T | undefined> {
    return (await getDB()).get(this.name, key) as Promise<T | undefined>;
  }

  async toArray(): Promise<T[]> {
    return (await getDB()).getAll(this.name) as Promise<T[]>;
  }

  async count(): Promise<number> {
    return (await getDB()).count(this.name);
  }

  async add(value: T): Promise<IDBValidKey> {
    const key = await (await getDB()).add(this.name, stampForWrite(this.name, value as Rec));
    fireWrite();
    return key;
  }

  async put(value: T): Promise<IDBValidKey> {
    const key = await (await getDB()).put(this.name, stampForWrite(this.name, value as Rec));
    fireWrite();
    return key;
  }

  async update(key: IDBValidKey, changes: Partial<T>): Promise<number> {
    const db = await getDB();
    const current = (await db.get(this.name, key)) as Rec | undefined;
    if (!current) return 0;
    const patch = { ...(changes as Rec) };
    if (isSyncable(this.name) && !("updatedAt" in patch)) patch.updatedAt = Date.now();
    await db.put(this.name, { ...current, ...patch });
    fireWrite();
    return 1;
  }

  async delete(key: IDBValidKey): Promise<void> {
    await (await getDB()).delete(this.name, key);
    fireWrite();
  }

  async bulkAdd(values: T[]): Promise<void> {
    if (values.length === 0) return;
    const db = await getDB();
    const tx = db.transaction(this.name, "readwrite");
    await Promise.all(values.map((v) => tx.store.add(stampForWrite(this.name, v as Rec))));
    await tx.done;
    fireWrite();
  }

  async bulkPut(values: T[]): Promise<void> {
    if (values.length === 0) return;
    const db = await getDB();
    const tx = db.transaction(this.name, "readwrite");
    await Promise.all(values.map((v) => tx.store.put(stampForWrite(this.name, v as Rec))));
    await tx.done;
    fireWrite();
  }

  async bulkGet(keys: IDBValidKey[]): Promise<(T | undefined)[]> {
    const db = await getDB();
    return Promise.all(keys.map((k) => db.get(this.name, k) as Promise<T | undefined>));
  }

  async bulkDelete(keys: IDBValidKey[]): Promise<void> {
    await this.bulkDeleteRaw(keys);
  }

  /** Interner Bulk-Delete ohne Tombstones (auch von Collection.delete genutzt). */
  async bulkDeleteRaw(keys: IDBValidKey[]): Promise<void> {
    if (keys.length === 0) return;
    const db = await getDB();
    const tx = db.transaction(this.name, "readwrite");
    await Promise.all(keys.map((k) => tx.store.delete(k)));
    await tx.done;
    fireWrite();
  }

  async clear(): Promise<void> {
    await (await getDB()).clear(this.name);
    fireWrite();
  }

  /** Liest über einen Index (Schlüssel, Range oder – ohne Query – in Indexreihenfolge). */
  async getAllByIndex(index: string, query?: IDBValidKey | IDBKeyRange): Promise<T[]> {
    return (await getDB()).getAllFromIndex(this.name, index, query) as Promise<T[]>;
  }

  where(index: string): WhereClause<T> {
    return new WhereClause<T>(this, index);
  }

  orderBy(index: string): Collection<T> {
    return new Collection<T>(this, () => this.getAllByIndex(index));
  }

  filter(predicate: (row: T) => boolean): Collection<T> {
    return new Collection<T>(this, async () => (await this.toArray()).filter(predicate));
  }

  toCollection(): Collection<T> {
    return new Collection<T>(this, () => this.toArray());
  }
}
