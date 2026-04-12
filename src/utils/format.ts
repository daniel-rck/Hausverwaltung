const eurFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

const numFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const intFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

const pctFormatter = new Intl.NumberFormat('de-DE', {
  style: 'percent',
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
  const [year, month] = ym.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

/** "2024-03-15" → "15.03.2024" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Monatsnamen auf Deutsch */
export const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
