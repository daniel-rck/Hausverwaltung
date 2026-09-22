import type { MeterReading } from "../../lib/db/schema";

export type YearConsumption = {
  /** Verbrauch im Zeitraum (Endstand − Anfangsstand). */
  consumption: number;
  /** Tage zwischen Anfangs- und Endablesung (für Tagesmittel). */
  days: number;
  from: MeterReading;
  to: MeterReading;
};

function daysBetween(a: string, b: string): number {
  const [ay = 0, am = 1, ad = 1] = a.split("-").map(Number);
  const [by = 0, bm = 1, bd = 1] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/**
 * Jahresverbrauch eines Zählers. Ablesungen erfolgen üblicherweise zum 31.12.
 * — dann liegt im Kalenderjahr nur eine einzige Ablesung, und „letzte − erste
 * im Jahr" ergäbe 0. Anfangsstand ist daher die letzte Ablesung *vor*
 * Jahresbeginn (typisch der Vorjahres-31.12.); nur wenn es keine gibt, die
 * erste im Jahr. Endstand ist die letzte Ablesung bis 31.12.
 *
 * `readings` = Ablesungen eines Zählers, beliebige Reihenfolge.
 */
export function consumptionForYear(
  readings: readonly MeterReading[],
  year: number,
): YearConsumption | null {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const sorted = [...readings]
    .filter((r) => r.date <= yearEnd)
    .sort((a, b) => a.date.localeCompare(b.date));
  const before = sorted.filter((r) => r.date < yearStart).at(-1);
  const inYear = sorted.filter((r) => r.date >= yearStart);
  const from = before ?? inYear[0];
  const to = inYear.at(-1);
  if (!from || !to || from === to) return null;
  const days = daysBetween(from.date, to.date);
  if (days <= 0) return null;
  return { consumption: Math.max(0, to.value - from.value), days, from, to };
}

export type CombinedConsumption = {
  /** Summierter Verbrauch aller Zähler (m³). */
  consumption: number;
  /** Summierte Tagesmittel (m³/Tag) — je Zähler über dessen eigenen Ablesezeitraum. */
  perDay: number;
};

/**
 * Fasst die Jahresverbräuche mehrerer Zähler zusammen (z. B. Warm- + Kaltwasser
 * einer Einheit). Zähler ohne auswertbaren Zeitraum (`null`) werden übersprungen.
 * Das Tagesmittel wird je Zähler gebildet, weil die Ablesezeiträume abweichen
 * können. Liefert `null`, wenn kein Zähler auswertbar ist.
 */
export function combineConsumption(
  parts: readonly (YearConsumption | null)[],
): CombinedConsumption | null {
  let consumption = 0;
  let perDay = 0;
  let any = false;
  for (const part of parts) {
    if (!part) continue;
    any = true;
    consumption += part.consumption;
    perDay += part.consumption / part.days;
  }
  return any ? { consumption, perDay } : null;
}
