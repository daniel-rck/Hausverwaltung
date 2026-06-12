import { useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { MeterReading, MeterType } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { formatDate, formatNumber } from "../../lib/utils/format";
import { SOURCE_LABELS, useMeterOptions } from "./useMeterOptions";

interface ReadingFormProps {
  selectedMeterId: number | null;
  onMeterChange: (meterId: number | null) => void;
}

export function ReadingForm({ selectedMeterId, onMeterChange }: ReadingFormProps) {
  const { activeProperty } = useProperty();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [value, setValue] = useState(0);
  const [source, setSource] = useState<MeterReading["source"]>("self");
  const [saving, setSaving] = useState(false);

  const meterOptions = useMeterOptions(activeProperty?.id);

  const recentReadings = useLiveQuery(async () => {
    if (!selectedMeterId) return [];
    return db.meterReadings
      .where("[meterId+date]")
      .between([selectedMeterId, ""], [selectedMeterId, "\uffff"])
      .reverse()
      .limit(10)
      .sortBy("date")
      .then((arr) => arr.reverse());
  }, [selectedMeterId]);

  const selectedMeterType = useLiveQuery(async (): Promise<MeterType | undefined> => {
    if (!selectedMeterId) return undefined;
    const meter = await db.meters.get(selectedMeterId);
    if (!meter) return undefined;
    return db.meterTypes.get(meter.meterTypeId);
  }, [selectedMeterId]);

  const handleSave = async () => {
    if (!selectedMeterId || !date || value < 0) return;
    setSaving(true);
    try {
      await db.meterReadings.add({
        meterId: selectedMeterId,
        date,
        value,
        source,
      });
      setValue(0);
      setDate(today);
      setSource("self");
    } finally {
      setSaving(false);
    }
  };

  const readingColumns: Column<MeterReading>[] = [
    {
      key: "date",
      header: "Datum",
      render: (r) => formatDate(r.date),
      sortValue: (r) => r.date,
    },
    {
      key: "value",
      header: "Zählerstand",
      render: (r) => (
        <span className="font-mono">
          {formatNumber(r.value)} {selectedMeterType?.unit ?? ""}
        </span>
      ),
      sortValue: (r) => r.value,
      align: "right",
    },
    {
      key: "source",
      header: "Quelle",
      render: (r) => SOURCE_LABELS[r.source],
    },
  ];

  return (
    <Card title="Ablesung erfassen">
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
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
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
              <span className="block text-xs font-medium text-fg-muted mb-1">Datum *</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumInput
            value={value}
            onChange={setValue}
            label={`Zählerstand${selectedMeterType?.unit ? ` (${selectedMeterType.unit})` : ""} *`}
            suffix={selectedMeterType?.unit}
            min={0}
          />
          <div>
            <label className="block">
              <span className="block text-xs font-medium text-fg-muted mb-1">Quelle *</span>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as MeterReading["source"])}
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
              >
                <option value="self">Eigene Ablesung</option>
                <option value="messdienst">Messdienstleister</option>
                <option value="versorger">Versorger</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedMeterId || !date || saving}
            className="px-4 py-1.5 text-sm bg-zinc-800 text-white rounded-lg hover:bg-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Speichere..." : "Ablesung speichern"}
          </button>
        </div>

        {selectedMeterId && (
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-fg mb-2">Letzte Ablesungen</h3>
            <DataTable
              columns={readingColumns}
              data={recentReadings ?? []}
              keyFn={(r) => r.id!}
              emptyMessage="Noch keine Ablesungen vorhanden."
            />
          </div>
        )}
      </div>
    </Card>
  );
}
