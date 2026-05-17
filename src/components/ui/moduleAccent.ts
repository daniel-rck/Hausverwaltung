export type ModulKey =
  | 'nebenkosten'
  | 'wasser'
  | 'mieter'
  | 'finanzen'
  | 'instandhaltung'
  | 'zaehler'
  | 'uebergabe'
  | 'rendite';

/**
 * Modul-Akzent-Klassen.
 *
 * **Hinweis (UI-Overhaul Linear/Vercel-Stil)**: Seit dem Refit werden Modul-Farben nur noch
 * für 2px-Bar-Indikatoren (Sidebar-active, PageHeader-Bar, KpiTile-Top) und Chart-Datasets verwendet.
 * Buttons, Pills, Cards, Tabs nutzen stattdessen den globalen Indigo-Akzent oder neutrale Zinc-Töne.
 *
 * Legacy-Felder (`text`, `bgSoft`, `border`, `hoverBg`, `ring`, `pillBg`, `pillText`,
 * `buttonBg`, `buttonHover`) liefern jetzt neutrale Klassen — die alte Call-Site bleibt funktional,
 * die Modul-Farbe wird aber visuell nicht mehr ausgespielt.
 *
 * Aktive Felder:
 * - `bg` / `bar` — 2px-Akzent-Bar (einziger Ort mit Modul-Farbe in der UI)
 * - `chart` — HEX-Wert für Chart.js-Datasets
 * - `iconWash` — sehr subtiler Container-Background für Modul-Icons (PageHeader)
 */
interface AccentClassSet {
  text: string;
  bg: string;
  bgSoft: string;
  border: string;
  hoverBg: string;
  ring: string;
  pillBg: string;
  pillText: string;
  buttonBg: string;
  buttonHover: string;
  /** 2px-Akzent-Bar (Sidebar-active, PageHeader-Bar) */
  bar: string;
  /** HEX-Wert für Chart.js-Datasets */
  chart: string;
  /** Subtiler Container-Background für Modul-Icon (PageHeader) */
  iconWash: string;
}

/** Neutrale Legacy-Felder — gleich für jedes Modul, damit alte Call-Sites visuell neutralisiert sind. */
const neutralLegacy = {
  text: 'text-zinc-700 dark:text-zinc-200',
  bgSoft: 'bg-zinc-50 dark:bg-zinc-800/40',
  border: 'border-zinc-200 dark:border-zinc-700',
  hoverBg: 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
  ring: 'focus-visible:ring-[--color-accent]/40',
  pillBg: 'bg-zinc-100 dark:bg-zinc-800',
  pillText: 'text-zinc-700 dark:text-zinc-200',
  /** Primary-Buttons nutzen jetzt den globalen Indigo-Akzent, unabhängig vom Modul */
  buttonBg: 'bg-[--color-accent]',
  buttonHover: 'hover:bg-[--color-accent-hover]',
} as const;

const accentMap: Record<ModulKey, AccentClassSet> = {
  nebenkosten: {
    ...neutralLegacy,
    bg: 'bg-amber-500 dark:bg-amber-400',
    bar: 'bg-amber-500 dark:bg-amber-400',
    chart: '#d97706',
    iconWash: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  wasser: {
    ...neutralLegacy,
    bg: 'bg-cyan-500 dark:bg-cyan-400',
    bar: 'bg-cyan-500 dark:bg-cyan-400',
    chart: '#0891b2',
    iconWash: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  },
  mieter: {
    ...neutralLegacy,
    bg: 'bg-green-500 dark:bg-green-400',
    bar: 'bg-green-500 dark:bg-green-400',
    chart: '#16a34a',
    iconWash: 'bg-green-500/10 text-green-700 dark:text-green-300',
  },
  finanzen: {
    ...neutralLegacy,
    bg: 'bg-emerald-500 dark:bg-emerald-400',
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    chart: '#059669',
    iconWash: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  instandhaltung: {
    ...neutralLegacy,
    bg: 'bg-rose-500 dark:bg-rose-400',
    bar: 'bg-rose-500 dark:bg-rose-400',
    chart: '#e11d48',
    iconWash: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  zaehler: {
    ...neutralLegacy,
    bg: 'bg-violet-500 dark:bg-violet-400',
    bar: 'bg-violet-500 dark:bg-violet-400',
    chart: '#7c3aed',
    iconWash: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  uebergabe: {
    ...neutralLegacy,
    bg: 'bg-blue-500 dark:bg-blue-400',
    bar: 'bg-blue-500 dark:bg-blue-400',
    chart: '#2563eb',
    iconWash: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  rendite: {
    ...neutralLegacy,
    bg: 'bg-yellow-500 dark:bg-yellow-400',
    bar: 'bg-yellow-500 dark:bg-yellow-400',
    chart: '#ca8a04',
    iconWash: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  },
};

export function moduleAccent(key: ModulKey | undefined): AccentClassSet | null {
  if (!key) return null;
  return accentMap[key];
}

export const moduleLabels: Record<ModulKey, string> = {
  nebenkosten: 'Nebenkosten',
  wasser: 'Wasser',
  mieter: 'Mieter',
  finanzen: 'Finanzen',
  instandhaltung: 'Instandhaltung',
  zaehler: 'Zähler',
  uebergabe: 'Übergabe',
  rendite: 'Rendite',
};
