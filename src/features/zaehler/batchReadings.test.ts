import { describe, expect, it } from "vitest";
import { buildReadingsFromRows, buildYearEndRows, type ReadingBatchRow } from "./batchReadings";

function row(date: string, value: number): ReadingBatchRow {
  return { key: `${date}-${value}`, date, value };
}

const baseArgs = { meterId: 7, source: "self" as const, existingDates: new Set<string>() };

describe("buildReadingsFromRows", () => {
  it("skips rows without date or with value 0", () => {
    const { toAdd, skippedDuplicates } = buildReadingsFromRows({
      ...baseArgs,
      rows: [row("", 5), row("2024-12-31", 0), row("2023-12-31", 123)],
    });
    expect(toAdd).toHaveLength(1);
    expect(toAdd[0]).toEqual({ meterId: 7, date: "2023-12-31", value: 123, source: "self" });
    expect(skippedDuplicates).toBe(0);
  });

  it("skips and counts dates already in the DB", () => {
    const { toAdd, skippedDuplicates } = buildReadingsFromRows({
      ...baseArgs,
      existingDates: new Set(["2024-12-31"]),
      rows: [row("2024-12-31", 5), row("2023-12-31", 4)],
    });
    expect(toAdd.map((r) => r.date)).toEqual(["2023-12-31"]);
    expect(skippedDuplicates).toBe(1);
  });

  it("keeps only the first occurrence of in-batch duplicate dates", () => {
    const { toAdd, skippedDuplicates } = buildReadingsFromRows({
      ...baseArgs,
      rows: [row("2024-12-31", 5), row("2024-12-31", 9)],
    });
    expect(toAdd).toHaveLength(1);
    expect(toAdd[0]?.value).toBe(5);
    expect(skippedDuplicates).toBe(1);
  });
});

describe("buildYearEndRows", () => {
  it("builds one 31.12. row per previous year", () => {
    const rows = buildYearEndRows({ years: 3, currentYear: 2026 });
    expect(rows.map((r) => r.date)).toEqual(["2025-12-31", "2024-12-31", "2023-12-31"]);
    expect(rows.every((r) => r.value === 0)).toBe(true);
  });

  it("generates unique keys", () => {
    const rows = buildYearEndRows({ years: 10, currentYear: 2026 });
    expect(new Set(rows.map((r) => r.key)).size).toBe(10);
  });
});
