import { describe, expect, it } from "vitest";
import type { RentChange } from "../db/schema";
import { buildRentLookup, rentColdAt } from "./rent";

const change = (effectiveDate: string, oldRentCold: number, newRentCold: number): RentChange => ({
  occupancyId: 1,
  effectiveDate,
  oldRentCold,
  newRentCold,
  reason: "mietspiegel",
});

describe("rentColdAt", () => {
  const occ = { id: 1, rentCold: 900 };
  const changes = [change("2025-06", 850, 900), change("2023-01", 800, 850)];

  it("nutzt die vor der ersten Änderung geltende Miete", () => {
    expect(rentColdAt(occ, "2022-12", changes)).toBe(800);
  });

  it("nutzt die zum Monat geltende Änderung", () => {
    expect(rentColdAt(occ, "2023-01", changes)).toBe(850);
    expect(rentColdAt(occ, "2025-05", changes)).toBe(850);
    expect(rentColdAt(occ, "2025-06", changes)).toBe(900);
  });

  it("fällt ohne Historie auf occupancy.rentCold zurück", () => {
    expect(rentColdAt(occ, "2024-01", [])).toBe(900);
  });

  it("Lookup gruppiert nach Belegung", () => {
    const lookup = buildRentLookup(changes);
    expect(lookup(occ, "2024-01")).toBe(850);
    expect(lookup({ id: 2, rentCold: 500 }, "2024-01")).toBe(500);
  });
});
