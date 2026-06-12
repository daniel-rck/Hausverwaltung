import { describe, expect, it } from "vitest";
import { type BillBatchRow, buildBillsFromRows, defaultBillingPeriod } from "./batchBills";

function row(overrides: Partial<BillBatchRow>): BillBatchRow {
  return {
    year: 2024,
    totalAmount: 0,
    totalConsumption: 0,
    billingFrom: "",
    billingTo: "",
    ...overrides,
  };
}

const baseArgs = { propertyId: 1, type: "water" as const, supplier: "Stadtwerke", unit: "m³" };

describe("defaultBillingPeriod", () => {
  it("returns the calendar year", () => {
    expect(defaultBillingPeriod(2019)).toEqual({ from: "2019-01-01", to: "2019-12-31" });
  });
});

describe("buildBillsFromRows", () => {
  it("skips rows without amount and consumption", () => {
    const bills = buildBillsFromRows({
      ...baseArgs,
      rows: [row({ year: 2024 }), row({ year: 2023, totalAmount: 120 })],
    });
    expect(bills).toHaveLength(1);
    expect(bills[0]?.year).toBe(2023);
  });

  it("keeps rows with only consumption or only amount", () => {
    const bills = buildBillsFromRows({
      ...baseArgs,
      rows: [row({ year: 2024, totalConsumption: 80 }), row({ year: 2023, totalAmount: 1 })],
    });
    expect(bills).toHaveLength(2);
  });

  it("defaults blank billing dates to the row's calendar year", () => {
    const bills = buildBillsFromRows({
      ...baseArgs,
      rows: [row({ year: 2020, totalAmount: 100 })],
    });
    expect(bills[0]?.billingFrom).toBe("2020-01-01");
    expect(bills[0]?.billingTo).toBe("2020-12-31");
  });

  it("passes explicit billing dates through", () => {
    const bills = buildBillsFromRows({
      ...baseArgs,
      rows: [
        row({ year: 2020, totalAmount: 100, billingFrom: "2020-03-01", billingTo: "2021-02-28" }),
      ],
    });
    expect(bills[0]?.billingFrom).toBe("2020-03-01");
    expect(bills[0]?.billingTo).toBe("2021-02-28");
  });

  it("trims the supplier and maps shared fields onto every bill", () => {
    const bills = buildBillsFromRows({
      ...baseArgs,
      supplier: "  Stadtwerke  ",
      rows: [row({ year: 2024, totalAmount: 1 }), row({ year: 2023, totalAmount: 2 })],
    });
    for (const bill of bills) {
      expect(bill.supplier).toBe("Stadtwerke");
      expect(bill.propertyId).toBe(1);
      expect(bill.type).toBe("water");
      expect(bill.unit).toBe("m³");
    }
  });
});
