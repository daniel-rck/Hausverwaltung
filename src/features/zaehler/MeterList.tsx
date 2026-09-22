import { useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import { cascadeDeleteMeter } from "../../lib/db/cascade";
import type { Meter, MeterReading, MeterType, Unit } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { StatusBadge } from "../../lib/ui/shared/StatusBadge";
import {
  Button,
  FormField,
  Input,
  required,
  Select,
  Skeleton,
  useConfirm,
  useFormValidation,
  useToast,
  type ValidationSchema,
} from "../../lib/ui/ui";
import { Gauge, Plus } from "../../lib/ui/ui/icons";
import { formatDate, formatNumber } from "../../lib/utils/format";

interface MeterRow {
  meter: Meter;
  meterType: MeterType;
  unit: Unit | null;
  lastReading: MeterReading | null;
}

type MeterFormData = {
  meterTypeId: string;
  serialNumber: string;
  unitId: string; // '' = Hauptzähler
  installDate: string;
  calibrationDue: string;
  notes: string;
};

const meterSchema: ValidationSchema<MeterFormData> = {
  meterTypeId: required("Bitte Zählertyp wählen"),
  serialNumber: required("Bitte Seriennummer angeben"),
};

const EMPTY_FORM: MeterFormData = {
  meterTypeId: "",
  serialNumber: "",
  unitId: "",
  installDate: "",
  calibrationDue: "",
  notes: "",
};

export function MeterList() {
  const { activeProperty } = useProperty();
  const [showForm, setShowForm] = useState(false);
  const [editMeter, setEditMeter] = useState<Meter | null>(null);
  const [form, setForm] = useState<MeterFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const { errors, validate, clear } = useFormValidation<MeterFormData>(meterSchema);

  const meterTypes = useLiveQuery(() => db.meterTypes.toArray()) ?? [];

  const units =
    useLiveQuery(async () => {
      if (!activeProperty?.id) return [];
      return db.units.where("propertyId").equals(activeProperty.id).toArray();
    }, [activeProperty?.id]) ?? [];

  const meterRows = useLiveQuery(async (): Promise<MeterRow[]> => {
    if (!activeProperty?.id) return [];

    const [propertyUnits, allMeters, types, allReadings] = await Promise.all([
      db.units.where("propertyId").equals(activeProperty.id).toArray(),
      db.meters.toArray(),
      db.meterTypes.toArray(),
      db.meterReadings.toArray(),
    ]);

    const unitMap = new Map(propertyUnits.flatMap((u) => (u.id != null ? [[u.id, u]] : [])));
    const unitIds = new Set(unitMap.keys());
    const typeMap = new Map(types.flatMap((t) => (t.id != null ? [[t.id, t]] : [])));

    const propertyMeters = allMeters.filter((m) => m.unitId === null || unitIds.has(m.unitId));

    // Letzten Reading je Meter in einem Pass: O(n_readings) statt O(n_meters * log n)
    const lastByMeter = new Map<number, MeterRow["lastReading"]>();
    for (const r of allReadings) {
      const prev = lastByMeter.get(r.meterId);
      if (!prev || r.date > prev.date) {
        lastByMeter.set(r.meterId, r);
      }
    }

    const rows: MeterRow[] = [];
    for (const meter of propertyMeters) {
      const mt = typeMap.get(meter.meterTypeId);
      if (!mt) continue;
      rows.push({
        meter,
        meterType: mt,
        unit: meter.unitId ? (unitMap.get(meter.unitId) ?? null) : null,
        lastReading: (meter.id != null ? lastByMeter.get(meter.id) : undefined) ?? null,
      });
    }
    return rows;
  }, [activeProperty?.id]);

  const hauptzaehler = meterRows?.filter((r) => r.meter.unitId === null) ?? [];
  const wohnungszaehler = meterRows?.filter((r) => r.meter.unitId !== null) ?? [];

  const handleOpenAdd = () => {
    setEditMeter(null);
    setForm(EMPTY_FORM);
    clear();
    setShowForm(true);
  };

  const handleOpenEdit = (meter: Meter) => {
    setEditMeter(meter);
    setForm({
      meterTypeId: String(meter.meterTypeId),
      serialNumber: meter.serialNumber,
      unitId: meter.unitId !== null ? String(meter.unitId) : "",
      installDate: meter.installDate ?? "",
      calibrationDue: meter.calibrationDue ?? "",
      notes: meter.notes ?? "",
    });
    clear();
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!validate(form)) return;

    const data: Omit<Meter, "id"> = {
      meterTypeId: Number(form.meterTypeId),
      serialNumber: form.serialNumber.trim(),
      unitId: form.unitId ? Number(form.unitId) : null,
      installDate: form.installDate || undefined,
      calibrationDue: form.calibrationDue || undefined,
      notes: form.notes.trim() || undefined,
    };

    setSaving(true);
    try {
      if (editMeter?.id) {
        await db.meters.put({ ...data, id: editMeter.id });
      } else {
        await db.meters.add(data as Meter);
      }
      toast.success(editMeter ? "Zähler aktualisiert." : "Zähler angelegt.");
      setShowForm(false);
      setEditMeter(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (meter: Meter) => {
    if (meter.id == null) return;
    const ok = await confirm({
      title: "Zähler löschen?",
      message: `Der Zähler „${meter.serialNumber}“ wird gelöscht. Alle zugehörigen Ablesungen werden ebenfalls gelöscht.`,
      confirmLabel: "Löschen",
      danger: true,
    });
    if (!ok) return;
    try {
      await cascadeDeleteMeter(meter.id);
      toast.success("Zähler gelöscht.");
      if (editMeter?.id === meter.id) {
        setShowForm(false);
        setEditMeter(null);
      }
    } catch (err) {
      toast.error("Löschen fehlgeschlagen.");
      console.error(err);
    }
  };

  const getCalibrationStatus = (
    meter: Meter,
  ): { status: "green" | "yellow" | "red" | "gray"; label: string } => {
    if (!meter.calibrationDue) return { status: "gray", label: "Keine Eichfrist" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${meter.calibrationDue}T00:00:00`);
    const diffMs = due.getTime() - today.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0) return { status: "red", label: "Abgelaufen" };
    if (days <= 90) return { status: "yellow", label: `${days} Tage` };
    return { status: "green", label: "OK" };
  };

  const makeColumns = (): Column<MeterRow>[] => [
    {
      key: "serial",
      header: "Seriennr.",
      render: (r) => <span className="font-mono text-xs">{r.meter.serialNumber}</span>,
      sortValue: (r) => r.meter.serialNumber,
    },
    {
      key: "type",
      header: "Zählertyp",
      render: (r) => r.meterType.name,
      sortValue: (r) => r.meterType.name,
    },
    {
      key: "location",
      header: "Zuordnung",
      render: (r) =>
        r.unit ? r.unit.name : <span className="text-fg-muted italic">Hauptzähler</span>,
      sortValue: (r) => r.unit?.name ?? "",
    },
    {
      key: "lastReading",
      header: "Letzter Stand",
      render: (r) =>
        r.lastReading ? (
          <span className="font-mono text-xs">
            {formatNumber(r.lastReading.value)} {r.meterType.unit}
            <span className="text-fg-subtle ml-1">({formatDate(r.lastReading.date)})</span>
          </span>
        ) : (
          <span className="text-fg-subtle">–</span>
        ),
      sortValue: (r) => r.lastReading?.value ?? 0,
      align: "right",
    },
    {
      key: "calibration",
      header: "Eichfrist",
      render: (r) => {
        const { status, label } = getCalibrationStatus(r.meter);
        return (
          <div className="flex items-center gap-2">
            {r.meter.calibrationDue && (
              <span className="text-xs text-fg-muted">{formatDate(r.meter.calibrationDue)}</span>
            )}
            <StatusBadge status={status} label={label} />
          </div>
        );
      },
      sortValue: (r) => r.meter.calibrationDue ?? "zzzz",
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(r.meter);
            }}
          >
            Bearbeiten
          </Button>
          <Button
            variant="dangerGhost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              void handleDelete(r.meter);
            }}
          >
            Löschen
          </Button>
        </div>
      ),
    },
  ];

  const formContent = (
    <form
      noValidate
      className="mb-4 p-4 bg-surface-muted rounded-lg border border-border"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
    >
      <h3 className="text-sm font-semibold text-fg mb-3">
        {editMeter ? "Zähler bearbeiten" : "Neuer Zähler"}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FormField label="Zählertyp" required error={errors.meterTypeId}>
          <Select
            value={form.meterTypeId}
            onChange={(e) => setForm({ ...form, meterTypeId: e.target.value })}
          >
            <option value="">– Typ wählen –</option>
            {meterTypes.flatMap((mt) =>
              mt.id != null
                ? [
                    <option key={mt.id} value={mt.id}>
                      {mt.name} ({mt.unit})
                    </option>,
                  ]
                : [],
            )}
          </Select>
        </FormField>
        <FormField label="Seriennummer" required error={errors.serialNumber}>
          <Input
            value={form.serialNumber}
            onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
            placeholder="z.B. WZ-2024-001"
          />
        </FormField>
        <FormField label="Zuordnung">
          <Select
            value={form.unitId}
            onChange={(e) => setForm({ ...form, unitId: e.target.value })}
          >
            <option value="">Hauptzähler (kein Wohnungsbezug)</option>
            {units.flatMap((u) =>
              u.id != null
                ? [
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>,
                  ]
                : [],
            )}
          </Select>
        </FormField>
        <FormField label="Einbaudatum">
          <Input
            type="date"
            value={form.installDate}
            onChange={(e) => setForm({ ...form, installDate: e.target.value })}
          />
        </FormField>
        <FormField label="Eichfrist bis">
          <Input
            type="date"
            value={form.calibrationDue}
            onChange={(e) => setForm({ ...form, calibrationDue: e.target.value })}
          />
        </FormField>
        <FormField label="Notizen">
          <Input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optionale Bemerkungen"
          />
        </FormField>
      </div>
      <div className="flex gap-2 mt-3">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Speichern
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowForm(false);
            setEditMeter(null);
          }}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );

  const meterKey = (r: MeterRow) => r.meter.id ?? r.meter.serialNumber;

  return (
    <Card
      title="Zähler-Übersicht"
      action={
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={handleOpenAdd}>
          Zähler
        </Button>
      }
    >
      {showForm && formContent}

      {meterRows === undefined && <Skeleton height="8rem" />}

      {hauptzaehler.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-2">
            Hauptzähler
          </h3>
          <DataTable columns={makeColumns()} data={hauptzaehler} keyFn={meterKey} />
        </div>
      )}

      {wohnungszaehler.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-2">
            Wohnungszähler
          </h3>
          <DataTable columns={makeColumns()} data={wohnungszaehler} keyFn={meterKey} />
        </div>
      )}

      {meterRows && meterRows.length === 0 && !showForm && (
        <EmptyState
          icon={<Gauge size={24} strokeWidth={1.75} />}
          title="Keine Zähler"
          description="Legen Sie Ihre Zähler an, um Ablesungen zu erfassen."
          action={{ label: "Zähler anlegen", onClick: handleOpenAdd }}
        />
      )}
    </Card>
  );
}
