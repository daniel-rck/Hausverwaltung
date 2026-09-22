import { useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { MeterReading, MeterType } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { NumInput } from "../../lib/ui/shared/NumInput";
import {
  Button,
  FormField,
  IconButton,
  Input,
  Select,
  useConfirm,
  useToast,
} from "../../lib/ui/ui";
import { Plus, X } from "../../lib/ui/ui/icons";
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
  const [meterError, setMeterError] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

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

  const removeRow = async (row: ReadingBatchRow) => {
    if (isReadingRowFilled(row)) {
      const ok = await confirm({
        title: "Zeile entfernen?",
        message: "Die eingegebene Ablesung in dieser Zeile wird verworfen.",
        confirmLabel: "Entfernen",
        danger: true,
      });
      if (!ok) return;
    }
    setRows((prev) => prev.filter((r) => r.key !== row.key));
    setResult(null);
  };

  const prefillYearEnds = async () => {
    if (rows.some(isReadingRowFilled)) {
      const ok = await confirm({
        title: "Zeilen ersetzen?",
        message: "Die bereits eingegebenen Zeilen werden durch leere Jahresend-Zeilen ersetzt.",
        confirmLabel: "Ersetzen",
        danger: true,
      });
      if (!ok) return;
    }
    setRows(buildYearEndRows({ years: YEAR_RANGE_BACK }));
    setResult(null);
  };

  const handleSave = async () => {
    if (!selectedMeterId) {
      setMeterError("Bitte Zähler wählen");
      return;
    }
    if (!rows.some(isReadingRowFilled)) {
      toast.warning("Bitte mindestens eine Zeile mit Datum und Zählerstand ausfüllen.");
      return;
    }
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
      toast.success(
        `${toAdd.length} ${toAdd.length === 1 ? "Ablesung" : "Ablesungen"} gespeichert.`,
      );
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Ablesungen im Batch erfassen">
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Zähler" required error={meterError ?? undefined}>
            <Select
              value={selectedMeterId ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setMeterError(null);
                onMeterChange(val ? Number(val) : null);
              }}
            >
              <option value="">– Zähler wählen –</option>
              {(meterOptions ?? []).flatMap((opt) =>
                opt.meter.id != null
                  ? [
                      <option key={opt.meter.id} value={opt.meter.id}>
                        {opt.label}
                      </option>,
                    ]
                  : [],
              )}
            </Select>
          </FormField>
          <FormField label="Quelle" required>
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value as MeterReading["source"])}
            >
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-end gap-2">
              <div className="flex-1">
                <FormField label="Datum">
                  <Input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateRow(row.key, { date: e.target.value })}
                  />
                </FormField>
              </div>
              <div className="flex-1">
                <FormField label="Zählerstand">
                  <NumInput
                    value={row.value}
                    onChange={(v) => updateRow(row.key, { value: v })}
                    suffix={selectedMeterType?.unit}
                    min={0}
                    decimals={3}
                  />
                </FormField>
              </div>
              <div className="pb-5">
                <IconButton
                  aria-label="Zeile entfernen"
                  icon={<X size={16} />}
                  onClick={() => void removeRow(row)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => {
              setRows((prev) => [...prev, makeEmptyRow()]);
              setResult(null);
            }}
          >
            Zeile hinzufügen
          </Button>
          <Button variant="outline" size="sm" onClick={() => void prefillYearEnds()}>
            Jahresenden vorbefüllen (letzte {YEAR_RANGE_BACK} Jahre)
          </Button>
        </div>

        <p className="text-xs text-fg-muted">
          Leere Zeilen und bereits vorhandene Daten (gleicher Zähler + Datum) werden beim Speichern
          übersprungen.
        </p>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" loading={saving}>
            Ablesungen speichern
          </Button>
          {result && (
            <span className="text-sm text-fg-muted">
              {result.added} gespeichert
              {result.skipped > 0 && `, ${result.skipped} übersprungen (Datum bereits vorhanden)`}.
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
