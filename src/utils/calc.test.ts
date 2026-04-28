import { describe, expect, it } from 'vitest';
import {
  cashflow,
  equityYield,
  getDistributionShare,
  getOccupiedMonthsFractional,
  grossYield,
  netYield,
  waterPerCapitaPerDay,
} from './calc';
import type { Occupancy, Unit } from '../db/schema';

function occUnit(
  unit: Partial<Unit>,
  occupancy: Partial<Occupancy>,
): { unit: Unit; occupancy: Occupancy } {
  return {
    unit: { id: 0, propertyId: 0, name: '', area: 0, ...unit } as Unit,
    occupancy: {
      id: 0,
      unitId: 0,
      tenantId: 0,
      from: '2024-01',
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

describe('grossYield', () => {
  it('returns annual rent / purchase price', () => {
    expect(grossYield(12_000, 300_000)).toBeCloseTo(0.04);
  });

  it('returns 0 for zero or negative purchase price (no division by zero)', () => {
    expect(grossYield(12_000, 0)).toBe(0);
    expect(grossYield(12_000, -5)).toBe(0);
  });
});

describe('netYield', () => {
  it('subtracts non-recoverable costs', () => {
    expect(netYield(12_000, 2_000, 250_000)).toBeCloseTo(0.04);
  });

  it('returns 0 for zero purchase price', () => {
    expect(netYield(10_000, 1_000, 0)).toBe(0);
  });

  it('can be negative (loss)', () => {
    expect(netYield(5_000, 8_000, 100_000)).toBeCloseTo(-0.03);
  });
});

describe('cashflow', () => {
  it('subtracts loan payment and non-recoverable costs from rent', () => {
    expect(cashflow(15_000, 8_000, 2_500)).toBe(4_500);
  });

  it('can go negative', () => {
    expect(cashflow(10_000, 9_000, 2_000)).toBe(-1_000);
  });
});

describe('equityYield', () => {
  it('returns cashflow / equity', () => {
    expect(equityYield(2_500, 50_000)).toBeCloseTo(0.05);
  });

  it('returns 0 for zero or negative equity', () => {
    expect(equityYield(1_000, 0)).toBe(0);
    expect(equityYield(1_000, -1)).toBe(0);
  });
});

describe('waterPerCapitaPerDay', () => {
  it('converts m³ → L per person per day with default 365 days', () => {
    // 100 m³ / 2 persons / 365 days = 100_000 / 2 / 365 ≈ 137 L
    expect(waterPerCapitaPerDay(100, 2)).toBeCloseTo(137, 0);
  });

  it('respects an explicit day count', () => {
    expect(waterPerCapitaPerDay(50, 1, 100)).toBeCloseTo(500, 0);
  });

  it('returns 0 for zero persons or days (no division by zero)', () => {
    expect(waterPerCapitaPerDay(50, 0)).toBe(0);
    expect(waterPerCapitaPerDay(50, 2, 0)).toBe(0);
  });
});

describe('getDistributionShare — area key', () => {
  it('shares proportional to area when both occupy full year', () => {
    const a = occUnit({ area: 80 }, { from: '2024-01', to: null });
    const b = occUnit({ area: 20 }, { from: '2024-01', to: null });
    expect(getDistributionShare('area', a, [a, b], 2024)).toBeCloseTo(0.8);
    expect(getDistributionShare('area', b, [a, b], 2024)).toBeCloseTo(0.2);
  });

  it('weights by occupied months when one tenant moved out mid-year', () => {
    // a: 80m² full year. b: 20m² for 6 months only (Jan–Jun).
    // weights: 80*12/12=80 vs 20*6/12=10 → total 90; b's share = 10/90 ≈ 0.111
    const a = occUnit({ area: 80 }, { from: '2024-01', to: null });
    const b = occUnit({ area: 20 }, { from: '2024-01', to: '2024-06' });
    expect(getDistributionShare('area', b, [a, b], 2024)).toBeCloseTo(10 / 90, 3);
  });

  it('clamps occupancy that started before the year to year-start', () => {
    // both tenants started Jan 2020 — for year 2024, both are present full year
    const a = occUnit({ area: 50 }, { from: '2020-01', to: null });
    const b = occUnit({ area: 50 }, { from: '2020-01', to: null });
    expect(getDistributionShare('area', a, [a, b], 2024)).toBeCloseTo(0.5);
  });

  it('returns 0 when total area is zero', () => {
    const a = occUnit({ area: 0 }, { from: '2024-01', to: null });
    expect(getDistributionShare('area', a, [a], 2024)).toBe(0);
  });
});

describe('getDistributionShare — persons key', () => {
  it('shares by occupant count, weighted by occupied months', () => {
    const a = occUnit({}, { from: '2024-01', to: null, persons: 3 });
    const b = occUnit({}, { from: '2024-01', to: null, persons: 1 });
    expect(getDistributionShare('persons', a, [a, b], 2024)).toBeCloseTo(0.75);
  });
});

describe('getDistributionShare — units key', () => {
  it('shares equally per unit when both occupy full year', () => {
    const a = occUnit({}, { from: '2024-01', to: null });
    const b = occUnit({}, { from: '2024-01', to: null });
    expect(getDistributionShare('units', a, [a, b], 2024)).toBeCloseTo(0.5);
    expect(getDistributionShare('units', b, [a, b], 2024)).toBeCloseTo(0.5);
  });

  it('half a year of occupancy gives proportionally less', () => {
    const a = occUnit({}, { from: '2024-01', to: null }); // full year
    const b = occUnit({}, { from: '2024-07', to: null }); // half year
    // weights: 1 vs 0.5 → total 1.5, b's share = 0.5/1.5 ≈ 0.333
    expect(getDistributionShare('units', b, [a, b], 2024)).toBeCloseTo(1 / 3, 3);
  });
});

describe('getOccupiedMonthsFractional', () => {
  it('returns 12 for a tenant occupying the entire year', () => {
    expect(
      getOccupiedMonthsFractional({ from: '2024-01', to: null }, 2024),
    ).toBeCloseTo(12, 1);
  });

  it('returns ~6 for a half-year occupancy (Jan–Jun)', () => {
    const m = getOccupiedMonthsFractional(
      { from: '2024-01', to: '2024-06' },
      2024,
    );
    // Jan 1 .. Jun 30 = 182 days / 366 (leap) * 12 ≈ 5.97
    expect(m).toBeGreaterThan(5.9);
    expect(m).toBeLessThan(6.1);
  });

  it('returns 0 when occupancy ends before the requested year', () => {
    expect(
      getOccupiedMonthsFractional({ from: '2020-01', to: '2020-12' }, 2024),
    ).toBe(0);
  });

  it('handles leap year (366 days) without rounding to 12.0 + epsilon', () => {
    const m = getOccupiedMonthsFractional({ from: '2024-01', to: null }, 2024);
    // Full year → exactly 12 within rounding tolerance
    expect(m).toBeCloseTo(12, 5);
  });

  it('clamps occupancies started before the year to year-start', () => {
    const m = getOccupiedMonthsFractional(
      { from: '2020-06', to: null },
      2024,
    );
    expect(m).toBeCloseTo(12, 1);
  });

  it('clamps occupancies ending after the year to year-end', () => {
    const m = getOccupiedMonthsFractional(
      { from: '2024-01', to: '2030-12' },
      2024,
    );
    expect(m).toBeCloseTo(12, 1);
  });
});
