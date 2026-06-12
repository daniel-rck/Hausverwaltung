import type { MeterReading } from "../../lib/db/schema";

export type ReadingBatchRow = {
  /** Stable React key — rows are removable, array index would break NumInput state. */
  key: string;
  date: string;
  value: number;
};

export function makeEmptyRow(): ReadingBatchRow {
  return { key: crypto.randomUUID(), date: "", value: 0 };
}

/** Prefill: one row per year-end (31.12.) for the last `years` years. */
export function buildYearEndRows(args: { years: number; currentYear?: number }): ReadingBatchRow[] {
  const currentYear = args.currentYear ?? new Date().getFullYear();
  const rows: ReadingBatchRow[] = [];
  for (let y = currentYear - 1; y >= currentYear - args.years; y--) {
    rows.push({ key: crypto.randomUUID(), date: `${y}-12-31`, value: 0 });
  }
  return rows;
}

export function isReadingRowFilled(row: ReadingBatchRow): boolean {
  return row.date !== "" && row.value > 0;
}

/**
 * Map filled rows to MeterReading records. The [meterId+date] index is not
 * unique, so duplicates (date already in DB, or repeated within the batch —
 * first occurrence wins) are skipped here and reported via `skippedDuplicates`.
 */
export function buildReadingsFromRows(args: {
  rows: ReadingBatchRow[];
  meterId: number;
  source: MeterReading["source"];
  existingDates: Set<string>;
}): { toAdd: Omit<MeterReading, "id">[]; skippedDuplicates: number } {
  const seen = new Set<string>();
  const toAdd: Omit<MeterReading, "id">[] = [];
  let skippedDuplicates = 0;

  for (const row of args.rows) {
    if (!isReadingRowFilled(row)) continue;
    if (args.existingDates.has(row.date) || seen.has(row.date)) {
      skippedDuplicates++;
      continue;
    }
    seen.add(row.date);
    toAdd.push({ meterId: args.meterId, date: row.date, value: row.value, source: args.source });
  }

  return { toAdd, skippedDuplicates };
}
