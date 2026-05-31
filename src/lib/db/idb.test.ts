import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, deleteWithTombstone } from "./index";

/**
 * Tests für den idb-gestützten DB-Layer (ersetzt Dexie). Deckt die zentralen
 * Query-/CRUD-Pfade ab, die im App-Code genutzt werden, damit Regressionen im
 * Wrapper früh auffallen (die Schicht ist sonst nur per Browser verifizierbar).
 */

async function wipe() {
  for (const t of db.tables) await t.clear();
}

beforeEach(wipe);

describe("Table CRUD", () => {
  it("add vergibt Auto-ID und stempelt syncId/updatedAt", async () => {
    const id = (await db.properties.add({ name: "Haus A", address: "Weg 1", units: 3 })) as number;
    expect(typeof id).toBe("number");
    const rec = await db.properties.get(id);
    expect(rec?.name).toBe("Haus A");
    expect(typeof rec?.syncId).toBe("string");
    expect(typeof rec?.updatedAt).toBe("number");
  });

  it("put upserted und update merged Felder", async () => {
    const id = (await db.units.add({ propertyId: 1, name: "EG", area: 50 })) as number;
    const changed = await db.units.update(id, { area: 55 });
    expect(changed).toBe(1);
    expect((await db.units.get(id))?.area).toBe(55);
    expect(await db.units.update(9999, { area: 1 })).toBe(0);
  });

  it("delete entfernt den Record", async () => {
    const id = (await db.tenants.add({ unitId: 1, name: "Müller" })) as number;
    await db.tenants.delete(id);
    expect(await db.tenants.get(id)).toBeUndefined();
  });

  it("settings nutzt key als Primärschlüssel (put/get)", async () => {
    await db.settings.put({ key: "landlord", value: { name: "X" } });
    expect((await db.settings.get("landlord"))?.value).toEqual({ name: "X" });
  });
});

describe("Indizes & Queries", () => {
  it("where().equals() über Einzelindex", async () => {
    await db.units.bulkPut([
      { propertyId: 1, name: "EG", area: 50 },
      { propertyId: 1, name: "OG", area: 60 },
      { propertyId: 2, name: "DG", area: 40 },
    ]);
    const p1 = await db.units.where("propertyId").equals(1).toArray();
    expect(p1).toHaveLength(2);
    expect(await db.units.where("propertyId").equals(2).count()).toBe(1);
  });

  it("where() über Compound-Index + first()", async () => {
    await db.payments.add({
      occupancyId: 7,
      month: "2026-01",
      amountCold: 100,
      amountUtilities: 20,
      method: "transfer",
    });
    const found = await db.payments.where("[occupancyId+month]").equals([7, "2026-01"]).first();
    expect(found?.amountCold).toBe(100);
    const none = await db.payments.where("[occupancyId+month]").equals([7, "2026-02"]).first();
    expect(none).toBeUndefined();
  });

  it("between() auf Compound-Index liefert Range + sortBy", async () => {
    await db.meterReadings.bulkPut([
      { meterId: 1, date: "2026-01", value: 10, source: "self" },
      { meterId: 1, date: "2026-06", value: 25, source: "self" },
      { meterId: 1, date: "2026-12", value: 40, source: "self" },
      { meterId: 2, date: "2026-06", value: 99, source: "self" },
    ]);
    const range = await db.meterReadings
      .where("[meterId+date]")
      .between([1, "2026-01"], [1, "2026-06"], true, true)
      .sortBy("date");
    expect(range.map((r) => r.value)).toEqual([10, 25]);
  });

  it("orderBy() iteriert in Indexreihenfolge", async () => {
    await db.costTypes.bulkPut([
      { name: "B", distribution: "area", category: "misc", sortOrder: 2 },
      { name: "A", distribution: "area", category: "misc", sortOrder: 1 },
      { name: "C", distribution: "area", category: "misc", sortOrder: 3 },
    ]);
    const ordered = await db.costTypes.orderBy("sortOrder").toArray();
    expect(ordered.map((c) => c.name)).toEqual(["A", "B", "C"]);
  });

  it("filter() und reverse()", async () => {
    await db.units.bulkPut([
      { propertyId: 1, name: "EG", area: 50 },
      { propertyId: 1, name: "OG", area: 60 },
    ]);
    const big = await db.units.filter((u) => u.area >= 55).toArray();
    expect(big).toHaveLength(1);
  });
});

describe("Tombstones", () => {
  it("deleteWithTombstone legt Tombstone an und löscht", async () => {
    const id = (await db.maintenanceItems.add({
      unitId: 1,
      date: "2026-01-01",
      category: "repair",
      title: "Fix",
      cost: 10,
      recurring: false,
    })) as number;
    const rec = await db.maintenanceItems.get(id);
    await deleteWithTombstone("maintenanceItems", id);
    expect(await db.maintenanceItems.get(id)).toBeUndefined();
    const ts = await db.tombstones.get(rec!.syncId!);
    expect(ts?.tableName).toBe("maintenanceItems");
  });

  it("where().below().delete() entfernt alte Tombstones", async () => {
    await db.tombstones.bulkPut([
      { syncId: "a", tableName: "units", deletedAt: 100 },
      { syncId: "b", tableName: "units", deletedAt: 5000 },
    ]);
    const removed = await db.tombstones.where("deletedAt").below(1000).delete();
    expect(removed).toBe(1);
    expect(await db.tombstones.count()).toBe(1);
  });
});
