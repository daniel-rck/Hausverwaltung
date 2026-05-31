import { describe, expect, it } from "vitest";
import type { RentChange } from "../db/schema";
import { checkRentIncrease, type RentLawCheckInput } from "./rentLaw";

function change(partial: Partial<RentChange>): RentChange {
  return {
    id: 0,
    occupancyId: 0,
    effectiveDate: "2020-01",
    oldRentCold: 0,
    newRentCold: 0,
    reason: "mietspiegel",
    ...partial,
  } as RentChange;
}

function input(partial: Partial<RentLawCheckInput>): RentLawCheckInput {
  return {
    effectiveDate: "2024-06",
    newRentCold: 1100,
    oldRentCold: 1000,
    reason: "mietspiegel",
    occupancyFrom: "2018-01",
    history: [],
    ...partial,
  };
}

describe("checkRentIncrease — gating", () => {
  it("returns no issues for non-Mietspiegel reasons (index/modernization/agreement)", () => {
    for (const reason of ["index", "modernization", "agreement"] as const) {
      expect(checkRentIncrease(input({ reason, newRentCold: 5000 }))).toEqual([]);
    }
  });

  it("returns no issues when the new rent is not higher than the old rent", () => {
    expect(checkRentIncrease(input({ newRentCold: 1000, oldRentCold: 1000 }))).toEqual([]);
    expect(checkRentIncrease(input({ newRentCold: 900, oldRentCold: 1000 }))).toEqual([]);
  });
});

describe("checkRentIncrease — 12-month lock since last increase", () => {
  it("flags an increase less than 12 months after the previous one", () => {
    const issues = checkRentIncrease(
      input({
        effectiveDate: "2024-06",
        history: [change({ effectiveDate: "2024-01", newRentCold: 1000 })],
      }),
    );
    expect(issues.some((i) => i.level === "error" && /Sperrfrist/.test(i.message))).toBe(true);
  });

  it("allows an increase 12+ months after the previous one", () => {
    const issues = checkRentIncrease(
      input({
        effectiveDate: "2024-06",
        oldRentCold: 1000,
        newRentCold: 1050, // small, within capping
        history: [change({ effectiveDate: "2023-06", newRentCold: 1000 })],
      }),
    );
    expect(issues.some((i) => /Sperrfrist/.test(i.message))).toBe(false);
  });
});

describe("checkRentIncrease — 15-month wait after move-in (first increase)", () => {
  it("flags a first increase earlier than 15 months after move-in", () => {
    const issues = checkRentIncrease(
      input({ occupancyFrom: "2024-01", effectiveDate: "2024-10", history: [] }),
    );
    expect(issues.some((i) => i.level === "error" && /15 Monate/.test(i.message))).toBe(true);
  });

  it("does not apply the 15-month rule when there is prior increase history", () => {
    const issues = checkRentIncrease(
      input({
        occupancyFrom: "2024-01",
        effectiveDate: "2025-06",
        history: [change({ effectiveDate: "2024-03", newRentCold: 1000 })],
      }),
    );
    expect(issues.some((i) => /15 Monate/.test(i.message))).toBe(false);
  });
});

describe("checkRentIncrease — Kappungsgrenze (3-year cap)", () => {
  it("flags an increase above the default 20% cap vs. the rent 3 years ago", () => {
    const issues = checkRentIncrease(
      input({
        effectiveDate: "2024-06",
        oldRentCold: 1100,
        newRentCold: 1300, // > 20% over 1000
        history: [change({ effectiveDate: "2021-06", newRentCold: 1000 })],
      }),
    );
    expect(
      issues.some((i) => i.level === "error" && /Kappungsgrenze überschritten/.test(i.message)),
    ).toBe(true);
  });

  it("respects a configurable lower cap (e.g. 15% in many cities)", () => {
    const issues = checkRentIncrease(
      input({
        effectiveDate: "2024-06",
        oldRentCold: 1100,
        newRentCold: 1180, // 18% over 1000 → ok at 20%, over at 15%
        cappingPct: 15,
        history: [change({ effectiveDate: "2021-06", newRentCold: 1000 })],
      }),
    );
    expect(issues.some((i) => /Kappungsgrenze überschritten/.test(i.message))).toBe(true);
  });

  it("stays silent (no cap error) when the 3-year increase is within the limit", () => {
    const issues = checkRentIncrease(
      input({
        effectiveDate: "2024-06",
        oldRentCold: 1050,
        newRentCold: 1100, // 10% over 1000
        history: [change({ effectiveDate: "2021-06", newRentCold: 1000 })],
      }),
    );
    expect(issues.some((i) => /Kappungsgrenze/.test(i.message))).toBe(false);
  });
});

describe("checkRentIncrease — 36-month reference date (year-boundary lock-in)", () => {
  // Pins that the reference month for effectiveDate "2024-02" is exactly
  // "2021-02" (not off-by-one across the year boundary). The baseline rent is
  // selected as the last change at-or-before the reference month.
  it("uses the rent in force exactly 36 months earlier as the cap baseline", () => {
    const history = [
      change({ effectiveDate: "2021-02", newRentCold: 1000 }),
      change({ effectiveDate: "2021-03", newRentCold: 1050 }),
    ];
    // newRent 1230: vs. 1000 (ref 2021-02) = 23% → over cap (error expected);
    // vs. 1050 (would be ref 2021-03 if month were off-by-one) = 17% → no error.
    const issues = checkRentIncrease(
      input({
        effectiveDate: "2024-02",
        oldRentCold: 1050,
        newRentCold: 1230,
        history,
      }),
    );
    expect(issues.some((i) => /Kappungsgrenze überschritten/.test(i.message))).toBe(true);
  });
});
