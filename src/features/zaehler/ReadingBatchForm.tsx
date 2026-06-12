import { useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { MeterReading, MeterType } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { YEAR_RANGE_BACK } from "../../lib/utils/years";
import {
  buildReadingsFromRows,
  buildYearEndRows,
  isReadingRowFilled,
  makeEmptyRow,
  type ReadingBatchRow,
} from "./batchReadings";
import { SOURCE_LABELS, useMeterOptions } from "./useMeterOptions";

interface ReadingBatchFormProps {
  selectedMeterId: number | null;
  onMeterChange: (meterId: number | null) => void;
}

const INPUT_CLASS =
  "w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500";

function makeInitialRows(): ReadingBatchRow[] {
  return [makeEmptyRow(), makeEmptyRow(), makeEmptyRow()];
}

/**
 * Batch entry for meter readings: meter + source once, then free
 * date/value rows — for retroactively entering years of readings.
 */
export function ReadingBatchForm({ selectedMeterId, onMeterChange }: ReadingBatchFormProps) {
  const { activeProperty } = useProperty();
  const [source, setSource] = useState<MeterReading["source"]>("self");
  const [rows, setRows] = useState<ReadingBatchRow[]>(makeInitialRows);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  const meterOptions = useMeterOptions(activeProperty?.id);

  const selectedMeterType = useLiveQuery(async (): Promise<MeterType | undefined> => {
    if (!selectedMeterId) return undefined;
    const meter = await db.meters.get(selectedMeterId);
    if (!meter) return undefined;
    return db.meterTypes.get(meter.meterTypeId);
  }, [selectedMeterId]);

  const updateRow = (key: string, patch: Partial<ReadingBatchRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setResult(null);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setResult(null);
  };

  const handleSave = async () => {
    if (!selectedMeterId) return;
    setSaving(true);
    try {
      const existing = await db.meterReadings
        .where("[meterId+date]")
        .between([selectedMeterId, ""], [selectedMeterId, "\uffff"])
        .toArray();
      const existingDates = new Set(existing.map((r) => r.date));
      const { toAdd, skippedDuplicates } = buildReadingsFromRows({
        rows,
        meterId: selectedMeterId,
        source,
        existingDates,
      });
      if (toAdd.length > 0) {
        await db.meterReadings.bulkAdd(toAdd as MeterReading[]);
      }
      setRows(makeInitialRows());
      setResult({ added: toAdd.length, skipped: skippedDuplicates });
    } finally {
      setSaving(false);
    }
  };

  const hasFilledRow = rows.some(isReadingRowFilled);

  return (
    <Card title="Ablesungen im Batch erfassen">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block">
              <span className="block text-xs font-medium text-fg-muted mb-1">Zähler *</span>
              <select
                value={selectedMeterId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  onMeterChange(val ? Number(val) : null);
                }}
                className={INPUT_CLASS}
              >
                <option value="">– Zähler wählen –</option>
                {(meterOptions ?? []).map((opt) => (
                  <option key={opt.meter.id!} value={opt.meter.id!}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label className="block">
              <span className="block text-xs font-medium text-fg-muted mb-1">Quelle *</span>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as MeterReading["source"])}
                className={INPUT_CLASS}
              >
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block">
                  <span className="block text-xs font-medium text-fg-muted mb-1">Datum</span>
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateRow(row.key, { date: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
              <div className="flex-1">
                <NumInput
                  value={row.value}
                  onChange={(v) => updateRow(row.key, { value: v })}
                  label="Zählerstand"
                  suffix={selectedMeterType?.unit}
                  min={0}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 border border-border rounded-lg"
                title="Zeile entfernen"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setRows((prev) => [...prev, makeEmptyRow()]);
              setResult(null);
            }}
            className="px-3 py-1.5 text-sm border border-border rounded-lg text-fg hover:bg-surface-muted transition-colors"
          >
            Zeile hinzufügen
          </button>
          <button
            type="button"
            onClick={() => {
              setRows(buildYearEndRows({ years: YEAR_RANGE_BACK }));
              setResult(null);
            }}
            className="px-3 py-1.5 text-sm border border-border rounded-lg text-fg hover:bg-surface-muted transition-colors"
          >
            Jahresenden vorbefüllen (letzte {YEAR_RANGE_BACK} Jahre)
          </button>
        </div>

        <p className="text-xs text-fg-muted">
          Leere Zeilen und bereits vorhandene Daten (gleicher Zähler + Datum) werden beim Speichern
          übersprungen.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedMeterId || !hasFilledRow || saving}
            className="px-4 py-1.5 text-sm bg-zinc-800 text-white rounded-lg hover:bg-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Speichere..." : "Ablesungen speichern"}
          </button>
          {result && (
            <span className="text-sm text-fg-muted">
              {result.added} gespeichert
              {result.skipped > 0 && `, ${result.skipped} übersprungen (Datum bereits vorhanden)`}.
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
