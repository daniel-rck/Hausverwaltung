export type ModulKey =
  | 'nebenkosten'
  | 'wasser'
  | 'mieter'
  | 'finanzen'
  | 'instandhaltung'
  | 'zaehler'
  | 'uebergabe'
  | 'rendite';

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
}

const accentMap: Record<ModulKey, AccentClassSet> = {
  nebenkosten: {
    text: 'text-amber-600 dark:text-amber-300',
    bg: 'bg-amber-600 dark:bg-amber-500',
    bgSoft: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-900',
    hoverBg: 'hover:bg-amber-100 dark:hover:bg-amber-950/60',
    ring: 'focus-visible:ring-amber-400',
    pillBg: 'bg-amber-100 dark:bg-amber-950/60',
    pillText: 'text-amber-800 dark:text-amber-200',
    buttonBg: 'bg-amber-600',
    buttonHover: 'hover:bg-amber-700',
  },
  wasser: {
    text: 'text-cyan-600 dark:text-cyan-300',
    bg: 'bg-cyan-600 dark:bg-cyan-500',
    bgSoft: 'bg-cyan-50 dark:bg-cyan-950/40',
    border: 'border-cyan-200 dark:border-cyan-900',
    hoverBg: 'hover:bg-cyan-100 dark:hover:bg-cyan-950/60',
    ring: 'focus-visible:ring-cyan-400',
    pillBg: 'bg-cyan-100 dark:bg-cyan-950/60',
    pillText: 'text-cyan-800 dark:text-cyan-200',
    buttonBg: 'bg-cyan-600',
    buttonHover: 'hover:bg-cyan-700',
  },
  mieter: {
    text: 'text-green-600 dark:text-green-300',
    bg: 'bg-green-600 dark:bg-green-500',
    bgSoft: 'bg-green-50 dark:bg-green-950/40',
    border: 'border-green-200 dark:border-green-900',
    hoverBg: 'hover:bg-green-100 dark:hover:bg-green-950/60',
    ring: 'focus-visible:ring-green-400',
    pillBg: 'bg-green-100 dark:bg-green-950/60',
    pillText: 'text-green-800 dark:text-green-200',
    buttonBg: 'bg-green-600',
    buttonHover: 'hover:bg-green-700',
  },
  finanzen: {
    text: 'text-emerald-600 dark:text-emerald-300',
    bg: 'bg-emerald-600 dark:bg-emerald-500',
    bgSoft: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-900',
    hoverBg: 'hover:bg-emerald-100 dark:hover:bg-emerald-950/60',
    ring: 'focus-visible:ring-emerald-400',
    pillBg: 'bg-emerald-100 dark:bg-emerald-950/60',
    pillText: 'text-emerald-800 dark:text-emerald-200',
    buttonBg: 'bg-emerald-600',
    buttonHover: 'hover:bg-emerald-700',
  },
  instandhaltung: {
    text: 'text-rose-600 dark:text-rose-300',
    bg: 'bg-rose-600 dark:bg-rose-500',
    bgSoft: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-900',
    hoverBg: 'hover:bg-rose-100 dark:hover:bg-rose-950/60',
    ring: 'focus-visible:ring-rose-400',
    pillBg: 'bg-rose-100 dark:bg-rose-950/60',
    pillText: 'text-rose-800 dark:text-rose-200',
    buttonBg: 'bg-rose-600',
    buttonHover: 'hover:bg-rose-700',
  },
  zaehler: {
    text: 'text-violet-600 dark:text-violet-300',
    bg: 'bg-violet-600 dark:bg-violet-500',
    bgSoft: 'bg-violet-50 dark:bg-violet-950/40',
    border: 'border-violet-200 dark:border-violet-900',
    hoverBg: 'hover:bg-violet-100 dark:hover:bg-violet-950/60',
    ring: 'focus-visible:ring-violet-400',
    pillBg: 'bg-violet-100 dark:bg-violet-950/60',
    pillText: 'text-violet-800 dark:text-violet-200',
    buttonBg: 'bg-violet-600',
    buttonHover: 'hover:bg-violet-700',
  },
  uebergabe: {
    text: 'text-blue-600 dark:text-blue-300',
    bg: 'bg-blue-600 dark:bg-blue-500',
    bgSoft: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-900',
    hoverBg: 'hover:bg-blue-100 dark:hover:bg-blue-950/60',
    ring: 'focus-visible:ring-blue-400',
    pillBg: 'bg-blue-100 dark:bg-blue-950/60',
    pillText: 'text-blue-800 dark:text-blue-200',
    buttonBg: 'bg-blue-600',
    buttonHover: 'hover:bg-blue-700',
  },
  rendite: {
    text: 'text-yellow-600 dark:text-yellow-300',
    bg: 'bg-yellow-600 dark:bg-yellow-500',
    bgSoft: 'bg-yellow-50 dark:bg-yellow-950/40',
    border: 'border-yellow-200 dark:border-yellow-900',
    hoverBg: 'hover:bg-yellow-100 dark:hover:bg-yellow-950/60',
    ring: 'focus-visible:ring-yellow-400',
    pillBg: 'bg-yellow-100 dark:bg-yellow-950/60',
    pillText: 'text-yellow-800 dark:text-yellow-200',
    buttonBg: 'bg-yellow-600',
    buttonHover: 'hover:bg-yellow-700',
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
