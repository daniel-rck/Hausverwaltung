import type { Occupancy, Unit } from '../db/schema';

interface OccupancyWithUnit {
  occupancy: Occupancy;
  unit: Unit;
}

/**
 * Verteilungsschlüssel: Anteil einer Belegung an den Gesamtkosten.
 * Gibt den Bruchteil (0–1) zurück.
 * Mit year-Parameter: zeitanteilige Gewichtung nach Belegungsmonaten.
 */
export function getDistributionShare(
  key: 'area' | 'persons' | 'units',
  current: OccupancyWithUnit,
  all: OccupancyWithUnit[],
  year?: number,
): number {
  const getMonths = (o: OccupancyWithUnit): number => {
    if (!year) return 12;
    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;
    const start = o.occupancy.from < yearStart ? yearStart : o.occupancy.from;
    const end = o.occupancy.to === null || o.occupancy.to > yearEnd ? yearEnd : o.occupancy.to;
    const [y1, m1] = start.split('-').map(Number);
    const [y2, m2] = end.split('-').map(Number);
    return Math.max(0, (y2 - y1) * 12 + (m2 - m1) + 1);
  };

  switch (key) {
    case 'area': {
      const weighted = all.map((o) => o.unit.area * (getMonths(o) / 12));
      const total = weighted.reduce((sum, w) => sum + w, 0);
      const currentWeight = current.unit.area * (getMonths(current) / 12);
      return total > 0 ? currentWeight / total : 0;
    }
    case 'persons': {
      const weighted = all.map((o) => o.occupancy.persons * (getMonths(o) / 12));
      const total = weighted.reduce((sum, w) => sum + w, 0);
      const currentWeight = current.occupancy.persons * (getMonths(current) / 12);
      return total > 0 ? currentWeight / total : 0;
    }
    case 'units': {
      const weighted = all.map((o) => getMonths(o) / 12);
      const total = weighted.reduce((sum, w) => sum + w, 0);
      const currentWeight = getMonths(current) / 12;
      return total > 0 ? currentWeight / total : 0;
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
