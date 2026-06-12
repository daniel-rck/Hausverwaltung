import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./index";
import { seedDatabase } from "./seed";

async function wipe() {
  for (const t of db.tables) await t.clear();
}

beforeEach(wipe);

describe("seedDatabase — Messdienst-Kostenarten", () => {
  it("frische DB: getrennte Messdienst-Typen statt Sammelposten", async () => {
    await seedDatabase();
    const names = (await db.costTypes.toArray()).map((ct) => ct.name);
    expect(names).toContain("Heizung (Messdienst)");
    expect(names).toContain("Warmwasser (Messdienst)");
    expect(names).toContain("Kaltwasser (Messdienst)");
    expect(names).not.toContain("Heizung/Warmwasser");
  });

  it("Bestands-DB: fehlende Messdienst-Typen werden angehängt, Sammelposten bleibt", async () => {
    await db.costTypes.bulkAdd([
      { name: "Grundsteuer", distribution: "area", category: "tax", sortOrder: 1 },
      { name: "Heizung/Warmwasser", distribution: "messdienst", category: "heating", sortOrder: 4 },
      { name: "Sonstige", distribution: "units", category: "misc", sortOrder: 18 },
    ]);
    await seedDatabase();

    const all = await db.costTypes.toArray();
    const lump = all.find((ct) => ct.name === "Heizung/Warmwasser");
    expect(lump).toBeDefined();
    expect(lump?.sortOrder).toBe(4);

    const added = all.filter((ct) => ct.name.includes("(Messdienst)"));
    expect(added.map((ct) => ct.name).sort()).toEqual([
      "Heizung (Messdienst)",
      "Kaltwasser (Messdienst)",
      "Warmwasser (Messdienst)",
    ]);
    // angehängt hinter dem bisherigen Maximum, keine Umnummerierung
    for (const ct of added) expect(ct.sortOrder).toBeGreaterThan(18);
    expect(added.every((ct) => ct.distribution === "messdienst")).toBe(true);
  });

  it("ist idempotent: zweifacher Seed erzeugt keine Duplikate", async () => {
    await seedDatabase();
    const countAfterFirst = await db.costTypes.count();
    await seedDatabase();
    expect(await db.costTypes.count()).toBe(countAfterFirst);
  });
});
