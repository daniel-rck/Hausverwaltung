import type { SupplierBill } from "../../lib/db/schema";

export type BillBatchRow = {
  year: number;
  totalAmount: number;
  totalConsumption: number;
  /** Empty string falls back to the calendar year of the row. */
  billingFrom: string;
  billingTo: string;
};

export function defaultBillingPeriod(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function isRowFilled(row: BillBatchRow): boolean {
  return row.totalAmount > 0 || row.totalConsumption > 0;
}

/**
 * Map the filled rows of the batch form to SupplierBill records.
 * Empty rows are skipped. Duplicates per [year+type] are intentionally
 * allowed — multiple bills per year (Abschlag + Endabrechnung) are legitimate.
 */
export function buildBillsFromRows(args: {
  rows: BillBatchRow[];
  propertyId: number;
  type: SupplierBill["type"];
  supplier: string;
  unit: string;
}): Omit<SupplierBill, "id">[] {
  return args.rows.filter(isRowFilled).map((row) => {
    const fallback = defaultBillingPeriod(row.year);
    return {
      propertyId: args.propertyId,
      year: row.year,
      type: args.type,
      supplier: args.supplier.trim(),
      totalAmount: row.totalAmount,
      totalConsumption: row.totalConsumption,
      unit: args.unit,
      billingFrom: row.billingFrom || fallback.from,
      billingTo: row.billingTo || fallback.to,
    };
  });
}
