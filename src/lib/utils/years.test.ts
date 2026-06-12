import { describe, expect, it } from "vitest";
import { buildYearOptions, YEAR_RANGE_BACK } from "./years";

describe("buildYearOptions", () => {
  it("returns 11 descending years by default (current year to -10)", () => {
    const years = buildYearOptions({ currentYear: 2026 });
    expect(years).toHaveLength(YEAR_RANGE_BACK + 1);
    expect(years[0]).toBe(2026);
    expect(years[years.length - 1]).toBe(2016);
    expect([...years].sort((a, b) => b - a)).toEqual(years);
  });

  it("includes future years with yearsForward", () => {
    const years = buildYearOptions({ currentYear: 2026, yearsForward: 1 });
    expect(years[0]).toBe(2027);
    expect(years[years.length - 1]).toBe(2016);
  });

  it("respects a custom yearsBack", () => {
    const years = buildYearOptions({ currentYear: 2026, yearsBack: 3 });
    expect(years).toEqual([2026, 2025, 2024, 2023]);
  });

  it("defaults currentYear to the real clock", () => {
    const years = buildYearOptions();
    expect(years[0]).toBe(new Date().getFullYear());
  });
});
