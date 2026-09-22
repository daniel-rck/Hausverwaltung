import { useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { MeterReading, MeterType } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { NumInput } from "../../lib/ui/shared/NumInput";
import {
  Button,
  FormField,
  Input,
  required,
  Select,
  useFormValidation,
  useToast,
  type ValidationSchema,
} from "../../lib/ui/ui";
import { todayIso } from "../../lib/utils/dates";
import { formatDate, formatNumber } from "../../lib/utils/format";
import { SOURCE_LABELS, useMeterOptions } from "./useMeterOptions";

interface ReadingFormProps {
  selectedMeterId: number | null;
  onMeterChange: (meterId: number | null) => void;
}

type ReadingValues = { meter: number | null; date: string };

const readingSchema: ValidationSchema<ReadingValues> = {
  meter: (v) => (v ? null : "Bitte Zähler wählen"),
  date: required("Bitte Datum angeben"),
};

export function ReadingForm({ selectedMeterId, onMeterChange }: ReadingFormProps) {
  const { activeProperty } = useProperty();
  const today = todayIso();

  const [date, setDate] = useState(today);
  const [value, setValue] = useState(0);
  const [source, setSource] = useState<MeterReading["source"]>("self");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { errors, validate, setError } = useFormValidation<ReadingValues>(readingSchema);

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
    if (!validate({ meter: selectedMeterId, date })) return;
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
      toast.success("Ablesung gespeichert.");
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
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
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Zähler" required error={errors.meter}>
            <Select
              value={selectedMeterId ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setError("meter", null);
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
          <FormField label="Datum" required error={errors.date}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label={`Zählerstand${selectedMeterType?.unit ? ` (${selectedMeterType.unit})` : ""}`}
            required
          >
            <NumInput
              value={value}
              onChange={setValue}
              suffix={selectedMeterType?.unit}
              min={0}
              decimals={3}
            />
          </FormField>
          <FormField label="Quelle" required>
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value as MeterReading["source"])}
            >
              <option value="self">Eigene Ablesung</option>
              <option value="messdienst">Messdienstleister</option>
              <option value="versorger">Versorger</option>
            </Select>
          </FormField>
        </div>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={saving}>
            Ablesung speichern
          </Button>
        </div>

        {selectedMeterId && (
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-fg mb-2">Letzte Ablesungen</h3>
            <DataTable
              columns={readingColumns}
              data={recentReadings ?? []}
              keyFn={(r) => r.id ?? `${r.meterId}-${r.date}`}
              emptyMessage="Noch keine Ablesungen vorhanden."
            />
          </div>
        )}
      </form>
    </Card>
  );
}
