import { describe, expect, it } from "vitest";
import type { Occupancy, Unit } from "../db/schema";
import {
  cashflow,
  equityYield,
  getDistributionShare,
  getOccupiedMonthsFractional,
  grossYield,
  netYield,
  waterPerCapitaPerDay,
} from "./calc";

function occUnit(
  unit: Partial<Unit>,
  occupancy: Partial<Occupancy>,
): { unit: Unit; occupancy: Occupancy } {
  return {
    unit: { id: 0, propertyId: 0, name: "", area: 0, ...unit } as Unit,
    occupancy: {
      id: 0,
      unitId: 0,
      tenantId: 0,
      from: "2024-01",
      to: null,
      persons: 1,
      rentCold: 0,
      rentUtilities: 0,
      deposit: 0,
      depositPaid: false,
      ...occupancy,
    } as Occupancy,
  };
}

describe("grossYield", () => {
  it("returns annual rent / purchase price", () => {
    expect(grossYield(12_000, 300_000)).toBeCloseTo(0.04);
  });

  it("returns 0 for zero or negative purchase price (no division by zero)", () => {
    expect(grossYield(12_000, 0)).toBe(0);
    expect(grossYield(12_000, -5)).toBe(0);
  });
});

describe("netYield", () => {
  it("subtracts non-recoverable costs", () => {
    expect(netYield(12_000, 2_000, 250_000)).toBeCloseTo(0.04);
  });

  it("returns 0 for zero purchase price", () => {
    expect(netYield(10_000, 1_000, 0)).toBe(0);
  });

  it("can be negative (loss)", () => {
    expect(netYield(5_000, 8_000, 100_000)).toBeCloseTo(-0.03);
  });
});

describe("cashflow", () => {
  it("subtracts loan payment and non-recoverable costs from rent", () => {
    expect(cashflow(15_000, 8_000, 2_500)).toBe(4_500);
  });

  it("can go negative", () => {
    expect(cashflow(10_000, 9_000, 2_000)).toBe(-1_000);
  });
});

describe("equityYield", () => {
  it("returns cashflow / equity", () => {
    expect(equityYield(2_500, 50_000)).toBeCloseTo(0.05);
  });

  it("returns 0 for zero or negative equity", () => {
    expect(equityYield(1_000, 0)).toBe(0);
    expect(equityYield(1_000, -1)).toBe(0);
  });
});

describe("waterPerCapitaPerDay", () => {
  it("converts m³ → L per person per day with default 365 days", () => {
    // 100 m³ / 2 persons / 365 days = 100_000 / 2 / 365 ≈ 137 L
    expect(waterPerCapitaPerDay(100, 2)).toBeCloseTo(137, 0);
  });

  it("respects an explicit day count", () => {
    expect(waterPerCapitaPerDay(50, 1, 100)).toBeCloseTo(500, 0);
  });

  it("returns 0 for zero persons or days (no division by zero)", () => {
    expect(waterPerCapitaPerDay(50, 0)).toBe(0);
    expect(waterPerCapitaPerDay(50, 2, 0)).toBe(0);
  });
});

describe("getDistributionShare — area key", () => {
  it("shares proportional to area when both occupy full year", () => {
    const a = occUnit({ area: 80 }, { from: "2024-01", to: null });
    const b = occUnit({ area: 20 }, { from: "2024-01", to: null });
    expect(getDistributionShare("area", a, [a, b], 2024)).toBeCloseTo(0.8);
    expect(getDistributionShare("area", b, [a, b], 2024)).toBeCloseTo(0.2);
  });

  it("weights by occupied months when one tenant moved out mid-year", () => {
    // a: 80m² full year. b: 20m² for 6 months only (Jan–Jun).
    // weights: 80*12/12=80 vs 20*6/12=10 → total 90; b's share = 10/90 ≈ 0.111
    const a = occUnit({ area: 80 }, { from: "2024-01", to: null });
    const b = occUnit({ area: 20 }, { from: "2024-01", to: "2024-06" });
    expect(getDistributionShare("area", b, [a, b], 2024)).toBeCloseTo(10 / 90, 3);
  });

  it("clamps occupancy that started before the year to year-start", () => {
    // both tenants started Jan 2020 — for year 2024, both are present full year
    const a = occUnit({ area: 50 }, { from: "2020-01", to: null });
    const b = occUnit({ area: 50 }, { from: "2020-01", to: null });
    expect(getDistributionShare("area", a, [a, b], 2024)).toBeCloseTo(0.5);
  });

  it("returns 0 when total area is zero", () => {
    const a = occUnit({ area: 0 }, { from: "2024-01", to: null });
    expect(getDistributionShare("area", a, [a], 2024)).toBe(0);
  });
});

describe("getDistributionShare — persons key", () => {
  it("shares by occupant count, weighted by occupied months", () => {
    const a = occUnit({}, { from: "2024-01", to: null, persons: 3 });
    const b = occUnit({}, { from: "2024-01", to: null, persons: 1 });
    expect(getDistributionShare("persons", a, [a, b], 2024)).toBeCloseTo(0.75);
  });
});

describe("getDistributionShare — units key", () => {
  it("shares equally per unit when both occupy full year", () => {
    const a = occUnit({}, { from: "2024-01", to: null });
    const b = occUnit({}, { from: "2024-01", to: null });
    expect(getDistributionShare("units", a, [a, b], 2024)).toBeCloseTo(0.5);
    expect(getDistributionShare("units", b, [a, b], 2024)).toBeCloseTo(0.5);
  });

  it("half a year of occupancy gives proportionally less", () => {
    const a = occUnit({}, { from: "2024-01", to: null }); // full year
    const b = occUnit({}, { from: "2024-07", to: null }); // half year
    // weights: 1 vs 0.5 → total 1.5, b's share = 0.5/1.5 ≈ 0.333
    expect(getDistributionShare("units", b, [a, b], 2024)).toBeCloseTo(1 / 3, 3);
  });
});

describe("getDistributionShare — Leerstand trägt der Vermieter", () => {
  it("area: Verteilbasis ist die Gesamtfläche des Objekts", () => {
    // Zwei 50-m²-Einheiten, eine ganzjährig leer → Mieter trägt 50 %, nicht 100 %.
    const a = occUnit({ area: 50 }, { from: "2024-01", to: null });
    expect(getDistributionShare("area", a, [a], 2024, [{ area: 50 }, { area: 50 }])).toBeCloseTo(
      0.5,
    );
  });

  it("area: unterjähriger Leerstand reduziert nur den Anteil des Betroffenen", () => {
    const a = occUnit({ area: 50 }, { from: "2024-01", to: null });
    const b = occUnit({ area: 50 }, { from: "2024-07", to: null });
    const units = [{ area: 50 }, { area: 50 }];
    expect(getDistributionShare("area", a, [a, b], 2024, units)).toBeCloseTo(0.5);
    expect(getDistributionShare("area", b, [a, b], 2024, units)).toBeCloseTo(0.25);
  });

  it("units: Verteilbasis ist die Einheitenzahl", () => {
    const a = occUnit({}, { from: "2024-01", to: null });
    expect(
      getDistributionShare("units", a, [a], 2024, [{ area: 1 }, { area: 1 }, { area: 1 }]),
    ).toBeCloseTo(1 / 3);
  });
});

describe("getDistributionShare — normalization invariant", () => {
  // Design-Festschreibung: die Anteile aller übergebenen Belegungen summieren
  // sich (per Konstruktion weight/totalWeight) auf 1. Leerstandskosten werden
  // damit auf die anwesenden Belegungen normiert verteilt — wer dem Aufrufer
  // diese Liste übergibt, bestimmt die Verteilbasis. Verhindert versehentliche
  // Regressionen, die die Summe ≠ 1 machen würden.
  it("shares of all occupancies sum to 1 (area, mixed durations)", () => {
    const a = occUnit({ area: 70 }, { from: "2024-01", to: null });
    const b = occUnit({ area: 30 }, { from: "2024-04", to: "2024-09" });
    const all = [a, b];
    const sum = all.reduce((s, o) => s + getDistributionShare("area", o, all, 2024), 0);
    expect(sum).toBeCloseTo(1, 6);
  });
});

describe("getOccupiedMonthsFractional — day-precise end date", () => {
  it('honours an explicit day in the "to" field (YYYY-MM-DD)', () => {
    // Jan 1 .. Jan 15 inclusive = 15 days / 366 (leap) * 12 ≈ 0.49
    const m = getOccupiedMonthsFractional({ from: "2024-01-01", to: "2024-01-15" }, 2024);
    expect(m).toBeCloseTo((15 / 366) * 12, 5);
  });

  it("counts fewer months for a mid-month move-out than the full month", () => {
    const midMonth = getOccupiedMonthsFractional({ from: "2024-01", to: "2024-06-15" }, 2024);
    const fullMonth = getOccupiedMonthsFractional({ from: "2024-01", to: "2024-06" }, 2024);
    expect(midMonth).toBeLessThan(fullMonth);
  });
});

describe("getOccupiedMonthsFractional", () => {
  it("returns 12 for a tenant occupying the entire year", () => {
    expect(getOccupiedMonthsFractional({ from: "2024-01", to: null }, 2024)).toBeCloseTo(12, 1);
  });

  it("returns exactly 6 for a month-granular half-year occupancy (Jan–Jun)", () => {
    expect(getOccupiedMonthsFractional({ from: "2025-01", to: "2025-06" }, 2025)).toBe(6);
    expect(getOccupiedMonthsFractional({ from: "2023-11", to: "2025-02" }, 2025)).toBe(2);
  });

  it("returns 0 when occupancy ends before the requested year", () => {
    expect(getOccupiedMonthsFractional({ from: "2020-01", to: "2020-12" }, 2024)).toBe(0);
  });

  it("handles leap year (366 days) without rounding to 12.0 + epsilon", () => {
    const m = getOccupiedMonthsFractional({ from: "2024-01", to: null }, 2024);
    // Full year → exactly 12 within rounding tolerance
    expect(m).toBeCloseTo(12, 5);
  });

  it("clamps occupancies started before the year to year-start", () => {
    const m = getOccupiedMonthsFractional({ from: "2020-06", to: null }, 2024);
    expect(m).toBeCloseTo(12, 1);
  });

  it("clamps occupancies ending after the year to year-end", () => {
    const m = getOccupiedMonthsFractional({ from: "2024-01", to: "2030-12" }, 2024);
    expect(m).toBeCloseTo(12, 1);
  });
});
