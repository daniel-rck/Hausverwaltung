import type { Occupancy, RentChange } from "../db/schema";

/**
 * Kaltmiete, die in `month` ("YYYY-MM") für eine Belegung galt.
 *
 * `occupancy.rentCold` ist die zuletzt vereinbarte Miete — nach einer
 * Mieterhöhung würde sie sonst rückwirkend für alle Vormonate als Soll gelten
 * (Vormonate „unterbezahlt", Mahnung über nicht geschuldete Beträge). Die
 * Historie in `rentChanges` ist maßgeblich: letzte Änderung mit
 * `effectiveDate <= month`, davor die `oldRentCold` der ersten Änderung.
 */
export function rentColdAt(
  occupancy: Pick<Occupancy, "rentCold">,
  month: string,
  changes: readonly RentChange[],
): number {
  if (changes.length === 0) return occupancy.rentCold;
  const sorted = [...changes].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  let rent = sorted[0]?.oldRentCold ?? occupancy.rentCold;
  for (const c of sorted) {
    if (c.effectiveDate.slice(0, 7) > month) break;
    rent = c.newRentCold;
  }
  return rent;
}

/**
 * Baut aus allen Mietänderungen eine Lookup-Funktion
 * `(occupancy, month) → Kaltmiete`, gruppiert nach Belegung.
 */
export function buildRentLookup(
  allChanges: readonly RentChange[],
): (occupancy: Pick<Occupancy, "id" | "rentCold">, month: string) => number {
  const byOcc = new Map<number, RentChange[]>();
  for (const c of allChanges) {
    const list = byOcc.get(c.occupancyId);
    if (list) list.push(c);
    else byOcc.set(c.occupancyId, [c]);
  }
  return (occ, month) =>
    rentColdAt(occ, month, occ.id === undefined ? [] : (byOcc.get(occ.id) ?? []));
}
