/**
 * Lokale Datums-Helfer. `new Date().toISOString()` liefert UTC — in Deutschland
 * ist das zwischen 0 und 1/2 Uhr noch der Vortag (am Monatsersten der Vormonat).
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Heutiges lokales Datum als "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Aktueller lokaler Monat als "YYYY-MM". */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** Lokales Datum `days` Tage ab `now` als "YYYY-MM-DD". */
export function isoInDays(days: number, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return todayIso(d);
}

/**
 * Letzter Monat, dessen Miete bereits fällig ist. Miete ist zum 3. Werktag
 * fällig (§556b BGB) — vereinfachend gilt der laufende Monat ab dem 4. als
 * fällig, davor erst der Vormonat.
 */
export function lastDueMonth(now: Date = new Date()): string {
  if (now.getDate() >= 4) return currentMonth(now);
  return currentMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}
