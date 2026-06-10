import { monthDiff } from "../utils/calc";
import { db } from "./index";
import type { MaintenanceItem, Occupancy, Unit } from "./schema";

/**
 * Gehört eine Maßnahme zur gegebenen Property? Wohnungsgebundene Einträge
 * über ihre Unit; Gemeinschafts-Einträge (unitId === null) über propertyId.
 * Legacy-Einträge ohne propertyId bleiben objektübergreifend sichtbar.
 */
export function isMaintenanceForProperty(
  item: MaintenanceItem,
  propertyId: number,
  unitIds: readonly number[],
): boolean {
  if (item.unitId === null) {
    return item.propertyId === undefined || item.propertyId === propertyId;
  }
  return unitIds.includes(item.unitId);
}

/** Aktuelle Belegung einer Wohneinheit zu einem Stichtag */
export async function getActiveOccupancy(
  unitId: number,
  date: string = new Date().toISOString().slice(0, 7),
): Promise<Occupancy | undefined> {
  const occupancies = await db.occupancies.where("unitId").equals(unitId).toArray();

  return occupancies.find((o) => o.from <= date && (o.to === null || o.to >= date));
}

/** Alle Belegungen einer Wohneinheit in einem bestimmten Jahr */
export async function getOccupanciesForYear(unitId: number, year: number): Promise<Occupancy[]> {
  const yearStart = `${year}-01`;
  const yearEnd = `${year}-12`;

  const occupancies = await db.occupancies.where("unitId").equals(unitId).toArray();

  return occupancies.filter((o) => o.from <= yearEnd && (o.to === null || o.to >= yearStart));
}

/** Leerstandszeiträume einer Wohneinheit in einem Jahr */
export async function getVacancyPeriods(
  unitId: number,
  year: number,
): Promise<{ from: string; to: string }[]> {
  const yearStart = `${year}-01`;
  const yearEnd = `${year}-12`;
  const occupancies = await getOccupanciesForYear(unitId, year);

  if (occupancies.length === 0) {
    return [{ from: yearStart, to: yearEnd }];
  }

  const sorted = occupancies.sort((a, b) => a.from.localeCompare(b.from));
  const gaps: { from: string; to: string }[] = [];

  const first = sorted[0];
  if (first && first.from > yearStart) {
    gaps.push({ from: yearStart, to: first.from });
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = sorted[i]?.to;
    const nextStart = sorted[i + 1]?.from;
    if (currentEnd && nextStart && currentEnd < nextStart) {
      gaps.push({ from: currentEnd, to: nextStart });
    }
  }

  const last = sorted[sorted.length - 1];
  if (last?.to && last.to < yearEnd) {
    gaps.push({ from: last.to, to: yearEnd });
  }

  return gaps;
}

/** Personenmonate für eine Wohneinheit in einem Jahr */
export async function getPersonMonths(unitId: number, year: number): Promise<number> {
  const occupancies = await getOccupanciesForYear(unitId, year);
  const yearStart = `${year}-01`;
  const yearEnd = `${year}-12`;

  let total = 0;
  for (const occ of occupancies) {
    const start = occ.from < yearStart ? yearStart : occ.from;
    const end = occ.to === null || occ.to > yearEnd ? yearEnd : occ.to;
    // Math.max: korrupte Belegungen (from > to) nicht negativ einrechnen
    const months = Math.max(0, monthDiff(start, end) + 1);
    total += months * occ.persons;
  }

  return total;
}

/** Verbrauch eines Zählers zwischen zwei Daten */
export async function getConsumption(
  meterId: number,
  from: string,
  to: string,
): Promise<number | null> {
  const readings = await db.meterReadings
    .where("[meterId+date]")
    .between([meterId, from], [meterId, to], true, true)
    .sortBy("date");

  const first = readings[0];
  const last = readings[readings.length - 1];
  if (readings.length < 2 || !first || !last) return null;
  return last.value - first.value;
}

/** Fehlende Mietzahlungen für einen Monat innerhalb einer Property */
export async function getOpenPayments(
  propertyId: number,
  month: string,
): Promise<{ unit: Unit; occupancy: Occupancy }[]> {
  const units = await db.units.where("propertyId").equals(propertyId).toArray();
  const unitIds = new Set(units.map((u) => u.id!));
  const unitMap = new Map(units.map((u) => [u.id!, u]));

  const allOccupancies = await db.occupancies.toArray();
  const active = allOccupancies.filter(
    (o) => unitIds.has(o.unitId) && o.from <= month && (o.to === null || o.to >= month),
  );

  const open: { unit: Unit; occupancy: Occupancy }[] = [];

  for (const occ of active) {
    const payment = await db.payments.where("[occupancyId+month]").equals([occ.id!, month]).first();

    if (!payment) {
      const unit = unitMap.get(occ.unitId);
      if (unit) {
        open.push({ unit, occupancy: occ });
      }
    }
  }

  return open;
}
