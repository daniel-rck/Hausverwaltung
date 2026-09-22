import { describe, expect, it } from "vitest";
import { formatNumberForInput, parseGermanNumber } from "./format";

describe("parseGermanNumber", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["1234,5", 1234.5],
    ["1.234,5", 1234.5],
    ["12.345.678,9", 12345678.9],
    ["2.400", 2400],
    ["1.234.567", 1234567],
    ["12.5", 12.5],
    ["3,875", 3.875],
    ["0", 0],
    ["-12,3", -12.3],
    [" 800 ", 800],
  ])("%s → %d", (input, expected) => {
    expect(parseGermanNumber(input)).toBe(expected);
  });

  it("liefert null für leere/ungültige Eingaben", () => {
    expect(parseGermanNumber("")).toBeNull();
    expect(parseGermanNumber("abc")).toBeNull();
    expect(parseGermanNumber("1,2,3")).toBeNull();
    expect(parseGermanNumber("1.2,3")).toBeNull();
    expect(parseGermanNumber("12.34,5")).toBeNull();
    expect(parseGermanNumber("1.234,")).toBeNull();
  });

  it("Roundtrip über formatNumberForInput verändert den Wert nicht", () => {
    for (const v of [3.875, 12.345, 1234.56, 2400, 0.001]) {
      expect(parseGermanNumber(formatNumberForInput(v))).toBe(v);
    }
  });
});
