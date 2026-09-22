import { describe, expect, it } from "vitest";
import type { MeterReading } from "../../lib/db/schema";
import { consumptionForYear } from "./consumption";

const r = (date: string, value: number): MeterReading =>
  ({ meterId: 1, date, value }) as MeterReading;

describe("consumptionForYear", () => {
  it("nutzt die Vorjahres-Ablesung als Anfangsstand (Ablesung je 31.12.)", () => {
    const res = consumptionForYear([r("2023-12-31", 100), r("2024-12-31", 160)], 2024);
    expect(res?.consumption).toBe(60);
    expect(res?.days).toBe(366);
  });

  it("fällt ohne Vorjahreswert auf die erste Ablesung im Jahr zurück", () => {
    const res = consumptionForYear([r("2024-03-01", 10), r("2024-09-01", 40)], 2024);
    expect(res?.consumption).toBe(30);
    expect(res?.days).toBe(184);
  });

  it("ignoriert Ablesungen nach Jahresende", () => {
    const res = consumptionForYear(
      [r("2023-12-31", 100), r("2024-12-31", 150), r("2025-06-30", 180)],
      2024,
    );
    expect(res?.consumption).toBe(50);
  });

  it("liefert null bei nur einer Ablesung", () => {
    expect(consumptionForYear([r("2024-12-31", 100)], 2024)).toBeNull();
  });
});
