import { formatEuro } from "../../utils/format";

/** Wertformat für Achsen-Ticks und Tooltips. */
export type ChartValueFormat = "euro" | "number";

export const CHART_LOCALE = "de-DE";

const euroTickFormatter = new Intl.NumberFormat(CHART_LOCALE, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat(CHART_LOCALE, { maximumFractionDigits: 2 });

/** Formatiert einen Achsen-Tick (Euro ohne Nachkommastellen). */
export function formatTick(value: number | string, format: ChartValueFormat): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return format === "euro" ? euroTickFormatter.format(n) : numberFormatter.format(n);
}

/** Formatiert einen Tooltip-Wert (Euro mit Cent). */
export function formatTooltipValue(value: number | null | undefined, format: ChartValueFormat) {
  if (value == null || Number.isNaN(value)) return "–";
  return format === "euro" ? formatEuro(value) : numberFormatter.format(value);
}
