const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const numFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const intFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});

const pctFormatter = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 1234.56 → "1.234,56 €" */
export function formatEuro(value: number): string {
  return eurFormatter.format(value);
}

/** 1234.56 → "1.234,56" */
export function formatNumber(value: number): string {
  return numFormatter.format(value);
}

/** 1234 → "1.234" */
export function formatInt(value: number): string {
  return intFormatter.format(value);
}

/** 0.145 → "14,5 %" */
export function formatPercent(value: number): string {
  return pctFormatter.format(value);
}

/** 65.3 → "65,30 m²" */
export function formatArea(value: number): string {
  return `${numFormatter.format(value)} m²`;
}

/** "2024-01" → "Januar 2024" */
export function formatMonth(ym: string): string {
  const [year = 0, month = 1] = ym.split("-").map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

/** "2024-03-15" → "15.03.2024" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Monatsnamen auf Deutsch */
export const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/**
 * Parst eine Zahleneingabe in deutscher Notation.
 * - Komma vorhanden → Komma ist Dezimaltrenner, Punkte sind Tausender:
 *   "1.234,56" → 1234.56
 * - Nur Punkte: genau ein Punkt mit exakt drei Ziffern danach bzw. mehrere
 *   Dreiergruppen gelten als Tausender ("1.234" → 1234, "1.234.567"),
 *   sonst ist der letzte Punkt Dezimaltrenner ("12.5" → 12.5).
 * Gibt `null` für leere oder ungültige Eingaben zurück.
 */
export function parseGermanNumber(input: string): number | null {
  let s = input.trim().replace(/\s/g, "");
  if (s === "") return null;
  if (s.includes(",")) {
    // Genau ein Komma; Punkte nur als korrekte Tausendergruppen ("1.234,5"),
    // sonst würde z. B. "1.2,3" stillschweigend zu 12,3.
    const [intPart = "", fracPart = "", ...rest] = s.split(",");
    if (rest.length > 0 || !/^\d+$/.test(fracPart)) return null;
    if (!/^-?\d+$/.test(intPart) && !/^-?\d{1,3}(\.\d{3})+$/.test(intPart)) return null;
    s = `${intPart.replace(/\./g, "")}.${fracPart}`;
  } else {
    const parts = s.split(".");
    if (parts.length > 1) {
      const head = parts.slice(0, -1);
      const last = parts[parts.length - 1] ?? "";
      const isGrouping =
        last.length === 3 &&
        /^-?\d{1,3}$/.test(head[0] ?? "") &&
        head.slice(1).every((p) => /^\d{3}$/.test(p));
      s = isGrouping ? parts.join("") : `${head.join("")}.${last}`;
    }
  }
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Zahl ohne Tausenderpunkte für Eingabefelder: 3.875 → "3,875" */
export function formatNumberForInput(value: number): string {
  return value.toLocaleString("de-DE", { useGrouping: false, maximumFractionDigits: 10 });
}
