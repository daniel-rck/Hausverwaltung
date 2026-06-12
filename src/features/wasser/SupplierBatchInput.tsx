import { useCallback, useState } from "react";
import { db } from "../../lib/db";
import type { SupplierBill } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { buildYearOptions } from "../../lib/utils/years";
import {
  type BillBatchRow,
  buildBillsFromRows,
  defaultBillingPeriod,
  isRowFilled,
} from "./batchBills";
import { type SupplierType, typeConfig } from "./supplierConfig";

interface SupplierBatchInputProps {
  type: SupplierType;
}

const INPUT_CLASS =
  "w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500";

function makeRows(): BillBatchRow[] {
  return buildYearOptions().map((year) => {
    const period = defaultBillingPeriod(year);
    return {
      year,
      totalAmount: 0,
      totalConsumption: 0,
      billingFrom: period.from,
      billingTo: period.to,
    };
  });
}

/**
 * Tabular batch entry for supplier bills: supplier + unit once,
 * one row per year (up to 10 years back). Empty rows are skipped.
 */
export function SupplierBatchInput({ type }: SupplierBatchInputProps) {
  const { activeProperty } = useProperty();
  const [supplier, setSupplier] = useState("");
  const [unit, setUnit] = useState(typeConfig[type].defaultUnit);
  const [rows, setRows] = useState<BillBatchRow[]>(makeRows);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  // Reset unit when the supplier type changes (re-render via key would lose rows).
  const [lastType, setLastType] = useState(type);
  if (lastType !== type) {
    setLastType(type);
    setUnit(typeConfig[type].defaultUnit);
    setSavedCount(null);
  }

  const config = typeConfig[type];
  const propertyId = activeProperty?.id;

  const updateRow = (year: number, patch: Partial<BillBatchRow>) => {
    setRows((prev) => prev.map((r) => (r.year === year ? { ...r, ...patch } : r)));
    setSavedCount(null);
  };

  const isValid = supplier.trim().length > 0 && rows.some(isRowFilled);

  const handleSave = useCallback(async () => {
    if (!propertyId || !supplier.trim()) return;
    setSaving(true);
    try {
      const bills = buildBillsFromRows({ rows, propertyId, type, supplier, unit });
      if (bills.length === 0) return;
      await db.supplierBills.bulkAdd(bills as SupplierBill[]);
      setRows(makeRows());
      setSavedCount(bills.length);
    } finally {
      setSaving(false);
    }
  }, [propertyId, rows, type, supplier, unit]);

  return (
    <Card title={`${config.label} – Batch-Erfassung`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block">
            <span className="block text-xs font-medium text-fg-muted mb-1">{config.label}</span>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="z.B. Stadtwerke"
              className={INPUT_CLASS}
            />
          </label>
        </div>
        {config.units.length > 1 && (
          <div>
            <label className="block">
              <span className="block text-xs font-medium text-fg-muted mb-1">Einheit</span>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={INPUT_CLASS}
              >
                {config.units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      <div className="overflow-x-auto mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-3 text-left font-medium text-fg-muted">Jahr</th>
              <th className="py-2 px-2 text-left font-medium text-fg-muted">Betrag</th>
              <th className="py-2 px-2 text-left font-medium text-fg-muted">Verbrauch</th>
              <th className="py-2 px-2 text-left font-medium text-fg-muted">Von</th>
              <th className="py-2 pl-2 text-left font-medium text-fg-muted">Bis</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="border-b border-border">
                <td className="py-1.5 pr-3 font-medium text-fg">{row.year}</td>
                <td className="py-1.5 px-2 min-w-[110px]">
                  <NumInput
                    value={row.totalAmount}
                    onChange={(v) => updateRow(row.year, { totalAmount: v })}
                    suffix="€"
                    min={0}
                  />
                </td>
                <td className="py-1.5 px-2 min-w-[110px]">
                  <NumInput
                    value={row.totalConsumption}
                    onChange={(v) => updateRow(row.year, { totalConsumption: v })}
                    suffix={unit}
                    min={0}
                  />
                </td>
                <td className="py-1.5 px-2">
                  <input
                    type="date"
                    value={row.billingFrom}
                    onChange={(e) => updateRow(row.year, { billingFrom: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </td>
                <td className="py-1.5 pl-2">
                  <input
                    type="date"
                    value={row.billingTo}
                    onChange={(e) => updateRow(row.year, { billingTo: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-fg-muted">
          Leere Zeilen (kein Betrag und kein Verbrauch) werden beim Speichern übersprungen.
        </p>
        <div className="flex items-center gap-3">
          {savedCount !== null && (
            <span className="text-sm text-fg-muted">
              {savedCount} {savedCount === 1 ? "Rechnung" : "Rechnungen"} gespeichert.
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid || saving}
            className="px-4 py-2 text-sm bg-zinc-800 text-white rounded-lg hover:bg-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Speichern..." : "Rechnungen speichern"}
          </button>
        </div>
      </div>
    </Card>
  );
}
