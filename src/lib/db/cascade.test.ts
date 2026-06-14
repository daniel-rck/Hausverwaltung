import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  cascadeDeleteMeter,
  cascadeDeleteOccupancy,
  cascadeDeleteProperty,
  cascadeDeleteUnit,
} from "./cascade";
import { db } from "./index";

/**
 * Tests für die kaskadierten Löschungen: jede Kaskade muss alle Kinder
 * entfernen UND für jeden gelöschten Record einen Tombstone anlegen,
 * sonst überlebt die Löschung den nächsten Sync nicht.
 */

async function wipe() {
  for (const t of db.tables) await t.clear();
}

beforeEach(wipe);

async function seed() {
  const propertyId = (await db.properties.add({ name: "Haus", address: "", units: 1 })) as number;
  const unitId = (await db.units.add({ propertyId, name: "EG", area: 50 })) as number;
  const tenantId = (await db.tenants.add({ unitId, name: "Müller" })) as number;
  const occId = (await db.occupancies.add({
    unitId,
    tenantId,
    persons: 2,
    from: "2025-01",
    to: null,
    rentCold: 500,
    rentUtilities: 100,
    deposit: 1000,
    depositPaid: true,
  })) as number;
  const meterTypeId = (await db.meterTypes.add({
    name: "Kaltwasser",
    unit: "m³",
    category: "water",
  })) as number;
  const meterId = (await db.meters.add({
    unitId,
    meterTypeId,
    serialNumber: "KW-001",
  })) as number;
  await db.meterReadings.add({ meterId, date: "2025-01-01", value: 1, source: "self" });
  await db.payments.add({
    occupancyId: occId,
    month: "2025-01",
    amountCold: 500,
    amountUtilities: 100,
    method: "transfer",
  });
  const costTypeId = (await db.costTypes.add({
    name: "Wasser",
    distribution: "persons",
    category: "water",
    sortOrder: 0,
  })) as number;
  const costId = (await db.costs.add({
    propertyId,
    year: 2025,
    costTypeId,
    totalAmount: 100,
  })) as number;
  await db.costShares.add({ costId, occupancyId: occId, amount: 50 });
  await db.prepayments.add({ occupancyId: occId, year: 2025, amount: 600 });
  await db.depositEvents.add({
    occupancyId: occId,
    date: "2025-01-01",
    type: "payment",
    amount: 1000,
  });
  await db.rentChanges.add({
    occupancyId: occId,
    effectiveDate: "2025-06",
    oldRentCold: 500,
    newRentCold: 520,
    reason: "agreement",
  });
  await db.handoverProtocols.add({
    occupancyId: occId,
    type: "move-in",
    date: "2025-01-01",
    rooms: [],
    meterReadings: [],
    keys: [],
    signatures: {},
  });
  await db.documents.add({
    entityType: "unit",
    entityId: unitId,
    name: "Grundriss",
    mimeType: "text/plain",
    size: 1,
    data: "x",
    uploadedAt: "2025-01-01",
  });
  await db.supplierBills.add({
    propertyId,
    year: 2025,
    type: "water",
    supplier: "Stadtwerke",
    totalAmount: 1,
    totalConsumption: 1,
    unit: "m³",
    billingFrom: "2025-01-01",
    billingTo: "2025-12-31",
  });
  await db.heatingStatements.add({
    propertyId,
    year: 2025,
    provider: "BRUNATA-METRONA",
    fuelType: "Heizöl",
    openingStock: { liters: 100, amount: 100 },
    purchases: [],
    closingStock: { liters: 0, amount: 0 },
    consumption: { liters: 100, amount: 100 },
    co2LandlordShare: 0,
    otherHeatingCosts: [],
    separateCosts: [],
    totalDistributed: 100,
  });
  await db.settings.put({ key: `financing_${propertyId}`, value: {} });
  return { propertyId, unitId, tenantId, occId, meterId, costId };
}

async function tombstoneTables(): Promise<Set<string>> {
  const ts = await db.tombstones.toArray();
  return new Set(ts.map((t) => t.tableName));
}

describe("cascadeDeleteOccupancy", () => {
  it("löscht alle belegungsbezogenen Kinder samt Tombstones", async () => {
    const { occId, unitId, tenantId } = await seed();
    await cascadeDeleteOccupancy(occId);

    expect(await db.occupancies.count()).toBe(0);
    expect(await db.payments.count()).toBe(0);
    expect(await db.costShares.count()).toBe(0);
    expect(await db.prepayments.count()).toBe(0);
    expect(await db.depositEvents.count()).toBe(0);
    expect(await db.rentChanges.count()).toBe(0);
    expect(await db.handoverProtocols.count()).toBe(0);

    // Eltern bleiben unangetastet
    expect(await db.units.get(unitId)).toBeDefined();
    expect(await db.tenants.get(tenantId)).toBeDefined();

    const tables = await tombstoneTables();
    for (const t of [
      "occupancies",
      "payments",
      "costShares",
      "prepayments",
      "depositEvents",
      "rentChanges",
      "handoverProtocols",
    ]) {
      expect(tables, `Tombstone für ${t}`).toContain(t);
    }
  });
});

describe("cascadeDeleteMeter", () => {
  it("löscht Zähler samt Ablesungen", async () => {
    const { meterId } = await seed();
    await cascadeDeleteMeter(meterId);
    expect(await db.meters.count()).toBe(0);
    expect(await db.meterReadings.count()).toBe(0);
    expect(await tombstoneTables()).toContain("meterReadings");
  });
});

describe("cascadeDeleteUnit", () => {
  it("löscht Belegungen, Mieter, Zähler und Dokumente der Wohnung", async () => {
    const { unitId, propertyId } = await seed();
    await cascadeDeleteUnit(unitId);

    expect(await db.units.count()).toBe(0);
    expect(await db.tenants.count()).toBe(0);
    expect(await db.occupancies.count()).toBe(0);
    expect(await db.meters.count()).toBe(0);
    expect(await db.meterReadings.count()).toBe(0);
    expect(await db.documents.count()).toBe(0);
    expect(await db.payments.count()).toBe(0);

    expect(await db.properties.get(propertyId)).toBeDefined();
  });
});

describe("cascadeDeleteProperty", () => {
  it("löscht das komplette Objekt inkl. Kosten, Versorger-Rechnungen und Settings", async () => {
    const { propertyId } = await seed();
    await cascadeDeleteProperty(propertyId);

    for (const table of [
      "properties",
      "units",
      "tenants",
      "occupancies",
      "costs",
      "costShares",
      "supplierBills",
      "heatingStatements",
      "payments",
      "documents",
      "meters",
      "meterReadings",
    ]) {
      expect(await db.table(table).count(), `${table} leer`).toBe(0);
    }
    expect(await db.settings.get(`financing_${propertyId}`)).toBeUndefined();

    const tables = await tombstoneTables();
    expect(tables).toContain("properties");
    expect(tables).toContain("settings");
  });
});
