// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { downloadSyncFile, EtagConflictError, uploadSyncFile } from "./cf-client";
import { syncService } from "./service";
import type { SyncSnapshot } from "./snapshot";

/**
 * Tests für die Sync-State-Machine (service.ts) mit gemocktem cf-client:
 * Push ohne Remote, Merge bei neuerem Remote, ETag-Konflikt-Retry und
 * klare Fehlermeldung bei korruptem Remote-Inhalt.
 */

vi.mock("./cf-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cf-client")>();
  return {
    ...actual,
    isEnabled: vi.fn(() => false),
    getSyncId: vi.fn(() => "test-id"),
    enableAsOwner: vi.fn(async () => ({ id: "test-id" })),
    disable: vi.fn(),
    downloadSyncFile: vi.fn(async () => null),
    uploadSyncFile: vi.fn(async () => "etag-1"),
  };
});

const downloadMock = vi.mocked(downloadSyncFile);
const uploadMock = vi.mocked(uploadSyncFile);

async function wipe() {
  for (const t of db.tables) await t.clear();
}

beforeEach(async () => {
  await wipe();
  localStorage.clear();
  downloadMock.mockReset().mockResolvedValue(null);
  uploadMock.mockReset().mockResolvedValue("etag-1");
});

afterEach(async () => {
  // Setzt Status/Hooks/Timer des Singletons zurück
  await syncService.disconnect();
});

function remoteSnapshot(tables: SyncSnapshot["tables"]): { content: string; etag: string } {
  const snap: SyncSnapshot = {
    version: 1,
    app: "hausverwaltung",
    exportedAt: Date.now(),
    tables,
    tombstones: [],
  };
  return { content: JSON.stringify(snap), etag: "remote-1" };
}

describe("syncService.connect → runSync", () => {
  it("pusht den lokalen Stand, wenn keine Remote-Datei existiert", async () => {
    await db.properties.add({ name: "Haus A", address: "", units: 2 });

    await syncService.connect();

    expect(syncService.getState().status).toBe("idle");
    expect(uploadMock).toHaveBeenCalledTimes(1);
    const uploaded = JSON.parse(uploadMock.mock.calls[0]?.[0] ?? "") as SyncSnapshot;
    expect(uploaded.tables.properties).toHaveLength(1);
    expect(localStorage.getItem("hv-sync-etag")).toBe("etag-1");
  });

  it("merged einen neueren Remote-Stand in die lokale DB", async () => {
    downloadMock.mockResolvedValue(
      remoteSnapshot({
        properties: [
          { syncId: "p-remote", name: "Remote-Haus", address: "", units: 1, updatedAt: Date.now() },
        ],
      }),
    );

    await syncService.connect();

    expect(syncService.getState().status).toBe("idle");
    const props = await db.properties.toArray();
    expect(props).toHaveLength(1);
    expect(props[0]?.name).toBe("Remote-Haus");
    expect(props[0]?.syncId).toBe("p-remote");
    // Nach Merge wird der zusammengeführte Stand hochgeladen
    expect(uploadMock).toHaveBeenCalled();
  });

  it("wiederholt den Sync genau einmal bei ETag-Konflikt", async () => {
    uploadMock
      .mockRejectedValueOnce(new EtagConflictError("Remote wurde parallel geändert."))
      .mockResolvedValueOnce("etag-2");
    await db.properties.add({ name: "Haus A", address: "", units: 2 });

    await syncService.connect();

    expect(syncService.getState().status).toBe("idle");
    expect(downloadMock).toHaveBeenCalledTimes(2);
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("hv-sync-etag")).toBe("etag-2");
  });

  it("meldet einen klaren Fehler bei korruptem Remote-Inhalt", async () => {
    downloadMock.mockResolvedValue({ content: "{nicht-json", etag: "x" });

    await syncService.connect();

    const state = syncService.getState();
    expect(state.status).toBe("error");
    expect(state.lastError).toMatch(/kein gültiges JSON/);
    // Lokale DB bleibt unangetastet, nichts wird hochgeladen
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("meldet einen klaren Fehler bei fremdem Snapshot-Format", async () => {
    downloadMock.mockResolvedValue({ content: JSON.stringify({ foo: 1 }), etag: "x" });

    await syncService.connect();

    expect(syncService.getState().status).toBe("error");
    expect(syncService.getState().lastError).toMatch(/unbekanntes Format/);
  });
});
