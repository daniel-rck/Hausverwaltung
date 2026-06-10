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
