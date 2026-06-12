/** Default range for retroactive data entry: 10 years back (Belegaufbewahrung). */
export const YEAR_RANGE_BACK = 10;

export type YearOptionsArgs = {
  yearsBack?: number;
  yearsForward?: number;
  /** Injectable for deterministic tests. */
  currentYear?: number;
};

/** Descending year list for year pickers, e.g. [2026, 2025, …, 2016]. */
export function buildYearOptions(options?: YearOptionsArgs): number[] {
  const currentYear = options?.currentYear ?? new Date().getFullYear();
  const yearsBack = options?.yearsBack ?? YEAR_RANGE_BACK;
  const yearsForward = options?.yearsForward ?? 0;

  const years: number[] = [];
  for (let y = currentYear + yearsForward; y >= currentYear - yearsBack; y--) {
    years.push(y);
  }
  return years;
}
