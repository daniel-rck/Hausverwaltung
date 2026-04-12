import type { Occupancy, Unit } from '../db/schema';

interface OccupancyWithUnit {
  occupancy: Occupancy;
  unit: Unit;
}

/**
 * Verteilungsschlüssel: Anteil einer Belegung an den Gesamtkosten.
 * Gibt den Bruchteil (0–1) zurück.
 */
export function getDistributionShare(
  key: 'area' | 'persons' | 'units',
  current: OccupancyWithUnit,
  all: OccupancyWithUnit[],
): number {
  switch (key) {
    case 'area': {
      const total = all.reduce((sum, o) => sum + o.unit.area, 0);
      return total > 0 ? current.unit.area / total : 0;
    }
    case 'persons': {
      const total = all.reduce((sum, o) => sum + o.occupancy.persons, 0);
      return total > 0 ? current.occupancy.persons / total : 0;
    }
    case 'units': {
      return all.length > 0 ? 1 / all.length : 0;
    }
  }
}

/** Bruttomietrendite = Jahresnettokaltmiete / Kaufpreis */
export function grossYield(annualColdRent: number, purchasePrice: number): number {
  if (purchasePrice <= 0) return 0;
  return annualColdRent / purchasePrice;
}

/** Nettomietrendite = (Mieteinnahmen - nicht umlagefähige Kosten) / Kaufpreis */
export function netYield(
  annualColdRent: number,
  nonRecoverableCosts: number,
  purchasePrice: number,
): number {
  if (purchasePrice <= 0) return 0;
  return (annualColdRent - nonRecoverableCosts) / purchasePrice;
}

/** Cashflow = Mieteinnahmen - Kreditrate - nicht umlagefähige Kosten */
export function cashflow(
  annualRent: number,
  annualLoanPayment: number,
  nonRecoverableCosts: number,
): number {
  return annualRent - annualLoanPayment - nonRecoverableCosts;
}

/** Eigenkapitalrendite = Cashflow / Eigenkapital */
export function equityYield(annualCashflow: number, equity: number): number {
  if (equity <= 0) return 0;
  return annualCashflow / equity;
}

/** Pro-Kopf-Wasserverbrauch: m³ → Liter pro Person pro Tag */
export function waterPerCapitaPerDay(
  cubicMeters: number,
  persons: number,
  days: number = 365,
): number {
  if (persons <= 0 || days <= 0) return 0;
  return (cubicMeters * 1000) / persons / days;
}
