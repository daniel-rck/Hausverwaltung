import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import type { HandoverProtocol } from "../db/schema";
import { applySnapshot, buildLocalSnapshot, parseSnapshot } from "./snapshot";

/**
 * Tests für Snapshot-Bau/-Anwendung: FK-Übersetzung (Top-Level und eingebettet
 * in handoverProtocols.meterReadings) sowie die Format-Validierung für
 * Remote-Inhalte.
 */

async function wipe() {
  for (const t of db.tables) await t.clear();
}

beforeEach(wipe);

describe("buildLocalSnapshot / applySnapshot", () => {
  it("übersetzt eingebettete meterIds in handoverProtocols hin und zurück", async () => {
    const unitId = (await db.units.add({ propertyId: 1, name: "EG", area: 50 })) as number;
    const tenantId = (await db.tenants.add({ unitId, name: "Müller" })) as number;
    const occId = (await db.occupancies.add({
      unitId,
      tenantId,
      persons: 2,
      from: "2025-01",
      to: null,
      rentCold: 500,
      rentUtilities: 150,
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
    await db.handoverProtocols.add({
      occupancyId: occId,
      type: "move-in",
      date: "2025-01-15",
      rooms: [],
      meterReadings: [{ meterId, value: 123.4 }],
      keys: [],
      signatures: {},
    } as HandoverProtocol);
    const meterSyncId = (await db.meters.get(meterId))?.syncId;

    const snapshot = await buildLocalSnapshot();

    // Wire-Format: syncId statt lokaler ID, keine rohen meterIds
    const wireProtocol = snapshot.tables.handoverProtocols?.[0] as {
      meterReadings: { meterId__sync?: string; meterId?: number; value: number }[];
    };
    expect(wireProtocol.meterReadings).toEqual([{ meterId__sync: meterSyncId, value: 123.4 }]);

    // "Anderes Gerät": leere Tabellen, Auto-Inc zählt weiter → lokale IDs
    // unterscheiden sich von denen des Export-Geräts.
    await wipe();
    await applySnapshot(snapshot);

    const meters = await db.meters.toArray();
    expect(meters).toHaveLength(1);
    const newMeterId = meters[0]?.id;
    expect(newMeterId).not.toBe(meterId);

    const protocols = await db.handoverProtocols.toArray();
    expect(protocols).toHaveLength(1);
    expect(protocols[0]?.meterReadings).toEqual([{ meterId: newMeterId, value: 123.4 }]);
  });

  it("übersetzt heatingStatements-propertyId hin und zurück", async () => {
    const propertyId = (await db.properties.add({
      name: "Haus",
      address: "Weg 1",
      units: 3,
    })) as number;
    await db.heatingStatements.add({
      propertyId,
      year: 2024,
      provider: "BRUNATA-METRONA",
      fuelType: "Heizöl",
      openingStock: { liters: 2420, amount: 1697.99 },
      purchases: [{ date: "2024-03-15", liters: 1000, amount: 950 }],
      closingStock: { liters: 500, amount: 475 },
      consumption: { liters: 2920, amount: 2172.99 },
      co2LandlordShare: 117.3,
      otherHeatingCosts: [{ label: "Brennerwartung", amount: 363.79 }],
      separateCosts: [],
      totalDistributed: 2419.48,
    });
    const propertySyncId = (await db.properties.get(propertyId))?.syncId;

    const snapshot = await buildLocalSnapshot();
    const wire = snapshot.tables.heatingStatements?.[0] as Record<string, unknown>;
    expect(wire.propertyId__sync).toBe(propertySyncId);
    expect(wire.propertyId).toBeUndefined();

    await wipe();
    await applySnapshot(snapshot);

    const statements = await db.heatingStatements.toArray();
    const newPropertyId = (await db.properties.toArray())[0]?.id;
    expect(statements).toHaveLength(1);
    expect(statements[0]?.propertyId).toBe(newPropertyId);
    // eingebettete Arrays überleben die Übersetzung unverändert
    expect(statements[0]?.purchases).toEqual([{ date: "2024-03-15", liters: 1000, amount: 950 }]);
    expect(statements[0]?.co2LandlordShare).toBe(117.3);
  });

  it("verwirft Readings, deren Zähler nicht (mehr) auflösbar ist", async () => {
    const unitId = (await db.units.add({ propertyId: 1, name: "EG", area: 50 })) as number;
    const tenantId = (await db.tenants.add({ unitId, name: "Müller" })) as number;
    const occId = (await db.occupancies.add({
      unitId,
      tenantId,
      persons: 1,
      from: "2025-01",
      to: null,
      rentCold: 500,
      rentUtilities: 150,
      deposit: 0,
      depositPaid: false,
    })) as number;
    await db.handoverProtocols.add({
      occupancyId: occId,
      type: "move-out",
      date: "2025-06-30",
      rooms: [],
      // meterId 999 existiert nicht → keine syncId auflösbar
      meterReadings: [{ meterId: 999, value: 7 }],
      keys: [],
      signatures: {},
    } as HandoverProtocol);

    const snapshot = await buildLocalSnapshot();
    const wireProtocol = snapshot.tables.handoverProtocols?.[0] as {
      meterReadings: unknown[];
    };
    expect(wireProtocol.meterReadings).toEqual([]);
  });

  it("verwirft Legacy-Readings mit roher meterId beim Import", async () => {
    // Wire-Format von vor dem __sync-Fix: rohe Auto-ID des Export-Geräts —
    // lokal nicht auflösbar, darf nicht als scheinbar gültige ID landen.
    await applySnapshot({
      version: 1,
      app: "hausverwaltung",
      exportedAt: Date.now(),
      tombstones: [],
      tables: {
        handoverProtocols: [
          {
            syncId: "hp-legacy",
            updatedAt: Date.now(),
            type: "move-in",
            date: "2025-01-01",
            rooms: [],
            keys: [],
            signatures: {},
            meterReadings: [{ meterId: 7, value: 3 }],
          },
        ],
      },
    });

    const protocols = await db.handoverProtocols.toArray();
    expect(protocols).toHaveLength(1);
    expect(protocols[0]?.meterReadings).toEqual([]);
  });
});

describe("applySnapshot — Unique-Index-Kollisionen", () => {
  it("löst doppelt angelegte Zahlung per LWW auf statt am Index zu scheitern", async () => {
    const unitId = (await db.units.add({ propertyId: 1, name: "EG", area: 50 })) as number;
    const tenantId = (await db.tenants.add({ unitId, name: "Müller" })) as number;
    const occupancyId = (await db.occupancies.add({
      unitId,
      tenantId,
      persons: 1,
      from: "2025-01",
      to: null,
      rentCold: 500,
      rentUtilities: 100,
      deposit: 0,
      depositPaid: false,
    })) as number;
    const paymentId = (await db.payments.add({
      occupancyId,
      month: "2025-03",
      amountCold: 500,
      amountUtilities: 100,
      method: "transfer",
    })) as number;
    const remote = await buildLocalSnapshot();
    const remoteRow = remote.tables.payments?.[0] as { updatedAt: number };
    remoteRow.updatedAt = Date.now() + 1000;

    // Lokal existiert dieselbe Zahlung unter anderer syncId (offline doppelt erfasst).
    const local = await db.payments.get(paymentId);
    await db.payments.put(
      {
        ...(local as NonNullable<typeof local>),
        syncId: "local-dup",
        amountCold: 450,
        updatedAt: 1,
      },
      { raw: true },
    );

    await expect(applySnapshot(remote)).resolves.not.toThrow();
    const payments = await db.payments.toArray();
    expect(payments).toHaveLength(1);
    expect(payments[0]?.amountCold).toBe(500);
    const tombstones = await db.tombstones.toArray();
    expect(tombstones.map((t) => t.syncId)).toContain("local-dup");
  });
});

async function seedPaymentScenario(month = "2025-03") {
  const unitId = (await db.units.add({ propertyId: 1, name: "EG", area: 50 })) as number;
  const tenantId = (await db.tenants.add({ unitId, name: "Müller" })) as number;
  const occupancyId = (await db.occupancies.add({
    unitId,
    tenantId,
    persons: 1,
    from: "2025-01",
    to: null,
    rentCold: 500,
    rentUtilities: 100,
    deposit: 0,
    depositPaid: false,
  })) as number;
  const paymentId = (await db.payments.add({
    occupancyId,
    month,
    amountCold: 500,
    amountUtilities: 100,
    method: "transfer",
  })) as number;
  return { occupancyId, paymentId };
}

describe("applySnapshot — deterministische Kollisionsauflösung", () => {
  async function runTie(remoteSyncId: string, localSyncId: string) {
    await wipe();
    const { paymentId } = await seedPaymentScenario();
    const remote = await buildLocalSnapshot();
    const row = remote.tables.payments?.[0] as { syncId: string; updatedAt: number };
    row.syncId = remoteSyncId;
    row.updatedAt = 1000;
    const local = await db.payments.get(paymentId);
    await db.payments.put(
      {
        ...(local as NonNullable<typeof local>),
        syncId: localSyncId,
        amountCold: 450,
        updatedAt: 1000,
      },
      { raw: true },
    );
    await applySnapshot(remote);
    const payments = await db.payments.toArray();
    const tombstones = (await db.tombstones.toArray()).map((t) => t.syncId);
    return { payments, tombstones };
  }

  it("wählt bei gleichem updatedAt den größeren syncId — unabhängig von der Rolle", async () => {
    const a = await runTie("b-sync", "a-sync");
    expect(a.payments).toHaveLength(1);
    expect(a.payments[0]?.syncId).toBe("b-sync");
    expect(a.tombstones).toContain("a-sync");
    expect(a.tombstones).not.toContain("b-sync");

    const b = await runTie("a-sync", "b-sync");
    expect(b.payments).toHaveLength(1);
    expect(b.payments[0]?.syncId).toBe("b-sync");
    expect(b.tombstones).toContain("a-sync");
    expect(b.tombstones).not.toContain("b-sync");
  });

  it("stempelt die Verlierer-Tombstone mindestens mit dessen updatedAt", async () => {
    const { paymentId } = await seedPaymentScenario();
    const remote = await buildLocalSnapshot();
    const row = remote.tables.payments?.[0] as { updatedAt: number };
    row.updatedAt = 1;
    const future = Date.now() + 10 * 86_400_000;
    const local = await db.payments.get(paymentId);
    await db.payments.put(
      { ...(local as NonNullable<typeof local>), syncId: "local-future", updatedAt: future },
      { raw: true },
    );
    // Lokal (Zukunft) gewinnt → die eingehende Version ist Verlierer.
    await applySnapshot(remote);
    expect((await db.payments.toArray()).map((p) => p.syncId)).toEqual(["local-future"]);

    // Umgekehrt: eingehend in der Zukunft, lokal verliert.
    await wipe();
    const s2 = await seedPaymentScenario();
    const remote2 = await buildLocalSnapshot();
    const row2 = remote2.tables.payments?.[0] as { updatedAt: number };
    row2.updatedAt = future + 1;
    const local2 = await db.payments.get(s2.paymentId);
    await db.payments.put(
      { ...(local2 as NonNullable<typeof local2>), syncId: "loser", updatedAt: future },
      { raw: true },
    );
    await applySnapshot(remote2);
    const ts = (await db.tombstones.toArray()).find((t) => t.syncId === "loser");
    expect(ts?.deletedAt).toBeGreaterThanOrEqual(future);
  });

  it("löst Kollisionen auch im Update-Pfad (geänderter Monat) auf", async () => {
    const { occupancyId, paymentId } = await seedPaymentScenario("2025-03");
    // Zweite Zahlung für April, lokal vorhanden.
    await db.payments.add({
      occupancyId,
      month: "2025-04",
      amountCold: 400,
      amountUtilities: 100,
      method: "transfer",
    });
    const remote = await buildLocalSnapshot();
    const marchSyncId = (await db.payments.get(paymentId))?.syncId;
    // Remote wurde die März-Zahlung auf April umgebucht (neuer).
    const marchRow = remote.tables.payments?.find((r) => r.syncId === marchSyncId) as {
      month: string;
      updatedAt: number;
    };
    marchRow.month = "2025-04";
    marchRow.updatedAt = Date.now() + 1000;
    // Die lokale April-Zahlung ist im Remote-Snapshot nicht enthalten.
    remote.tables.payments = (remote.tables.payments ?? []).filter((r) => r.syncId === marchSyncId);

    await expect(applySnapshot(remote)).resolves.not.toThrow();
    const payments = await db.payments.toArray();
    expect(payments).toHaveLength(1);
    expect(payments[0]?.syncId).toBe(marchSyncId);
    expect(payments[0]?.month).toBe("2025-04");
  });
});

describe("parseSnapshot", () => {
  it("akzeptiert einen gültigen Snapshot", async () => {
    const snap = await buildLocalSnapshot();
    expect(parseSnapshot(JSON.stringify(snap)).version).toBe(1);
  });

  it("wirft bei ungültigem JSON", () => {
    expect(() => parseSnapshot("{nope")).toThrow(/kein gültiges JSON/);
  });

  it("wirft bei fremdem Format", () => {
    expect(() => parseSnapshot(JSON.stringify({ hello: "world" }))).toThrow(/unbekanntes Format/);
    expect(() => parseSnapshot(JSON.stringify({ version: 2, tables: {}, tombstones: [] }))).toThrow(
      /unbekanntes Format/,
    );
    expect(() => parseSnapshot(JSON.stringify({ version: 1, tables: {}, tombstones: {} }))).toThrow(
      /unbekanntes Format/,
    );
    // tables muss ein Record mit Array-Werten sein
    expect(() =>
      parseSnapshot(
        JSON.stringify({ version: 1, tables: { handoverProtocols: {} }, tombstones: [] }),
      ),
    ).toThrow(/unbekanntes Format/);
    expect(() => parseSnapshot(JSON.stringify({ version: 1, tables: [], tombstones: [] }))).toThrow(
      /unbekanntes Format/,
    );
    expect(() => parseSnapshot("null")).toThrow(/unbekanntes Format/);
  });
});
