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

/**
 * Tagegenaue Belegungsdauer einer Belegung im Bezugsjahr.
 * Halbmonatige Mietverhältnisse werden korrekt anteilig verrechnet —
 * der angefangene Monat wird nicht voll gezählt.
 *
 * Berechnung: Anzahl belegter Tage / 365 (oder 366 im Schaltjahr) × 12.
 */
export function getOccupiedMonthsFractional(
  occupancy: { from: string; to: string | null },
  year: number,
): number {
  // Bei Belegungen im YYYY-MM-Format gibt es keinen exakten Tag — wir nehmen
  // den 1. des Eintrittsmonats und den letzten des Auszugsmonats.
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;

  const [fy, fm, fd = 1] = occupancy.from.split('-').map(Number);
  const start = new Date(Date.UTC(fy, fm - 1, fd));
  const effectiveStart = start < yearStart ? yearStart : start;

  let effectiveEnd: Date;
  if (occupancy.to === null) {
    effectiveEnd = yearEnd;
  } else {
    const parts = occupancy.to.split('-').map(Number);
    const [ty, tm, td] = parts;
    let endDate: Date;
    if (td !== undefined) {
      endDate = new Date(Date.UTC(ty, tm - 1, td));
    } else {
      // letzter Tag des Auszugsmonats
      endDate = new Date(Date.UTC(ty, tm, 0));
    }
    effectiveEnd = endDate > yearEnd ? yearEnd : endDate;
  }

  if (effectiveEnd < effectiveStart) return 0;

  const msPerDay = 24 * 60 * 60 * 1000;
  const days =
    Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / msPerDay) + 1;

  return (days / daysInYear) * 12;
}
