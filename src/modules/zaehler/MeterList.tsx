import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { EmptyState } from '../../components/shared/EmptyState';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDate, formatNumber } from '../../utils/format';
import type { Meter, MeterType, MeterReading, Unit } from '../../db/schema';

interface MeterRow {
  meter: Meter;
  meterType: MeterType;
  unit: Unit | null;
  lastReading: MeterReading | null;
}

interface MeterFormData {
  meterTypeId: string;
  serialNumber: string;
  unitId: string; // '' = Hauptzähler
  installDate: string;
  calibrationDue: string;
  notes: string;
}

const EMPTY_FORM: MeterFormData = {
  meterTypeId: '',
  serialNumber: '',
  unitId: '',
  installDate: '',
  calibrationDue: '',
  notes: '',
};

export function MeterList() {
  const { activeProperty } = useProperty();
  const [showForm, setShowForm] = useState(false);
  const [editMeter, setEditMeter] = useState<Meter | null>(null);
  const [form, setForm] = useState<MeterFormData>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Meter | null>(null);

  const meterTypes = useLiveQuery(() => db.meterTypes.toArray()) ?? [];

  const units = useLiveQuery(async () => {
    if (!activeProperty?.id) return [];
    return db.units
      .where('propertyId')
      .equals(activeProperty.id)
      .toArray();
  }, [activeProperty?.id]) ?? [];

  const meterRows = useLiveQuery(async (): Promise<MeterRow[]> => {
    if (!activeProperty?.id) return [];

    const propertyUnits = await db.units
      .where('propertyId')
      .equals(activeProperty.id)
      .toArray();
    const unitIds = propertyUnits.map((u) => u.id!);
    const unitMap = new Map(propertyUnits.map((u) => [u.id!, u]));

    const allMeters = await db.meters.toArray();
    const propertyMeters = allMeters.filter(
      (m) => m.unitId === null || unitIds.includes(m.unitId),
    );

    const types = await db.meterTypes.toArray();
    const typeMap = new Map(types.map((t) => [t.id!, t]));

    const rows: MeterRow[] = [];

    for (const meter of propertyMeters) {
      const readings = await db.meterReadings
        .where('[meterId+date]')
        .between([meter.id!, ''], [meter.id!, '\uffff'])
        .reverse()
        .limit(1)
        .sortBy('date');

      const lastReading = readings.length > 0 ? readings[readings.length - 1] : null;
      const mt = typeMap.get(meter.meterTypeId);

      if (mt) {
        rows.push({
          meter,
          meterType: mt,
          unit: meter.unitId ? unitMap.get(meter.unitId) ?? null : null,
          lastReading,
        });
      }
    }

    return rows;
  }, [activeProperty?.id]);

  const hauptzaehler = meterRows?.filter((r) => r.meter.unitId === null) ?? [];
  const wohnungszaehler = meterRows?.filter((r) => r.meter.unitId !== null) ?? [];

  const handleOpenAdd = () => {
    setEditMeter(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const handleOpenEdit = (meter: Meter) => {
    setEditMeter(meter);
    setForm({
      meterTypeId: String(meter.meterTypeId),
      serialNumber: meter.serialNumber,
      unitId: meter.unitId !== null ? String(meter.unitId) : '',
      installDate: meter.installDate ?? '',
      calibrationDue: meter.calibrationDue ?? '',
      notes: meter.notes ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.meterTypeId || !form.serialNumber.trim()) return;

    const data: Omit<Meter, 'id'> = {
      meterTypeId: Number(form.meterTypeId),
      serialNumber: form.serialNumber.trim(),
      unitId: form.unitId ? Number(form.unitId) : null,
      installDate: form.installDate || undefined,
      calibrationDue: form.calibrationDue || undefined,
      notes: form.notes.trim() || undefined,
    };

    if (editMeter?.id) {
      await db.meters.put({ ...data, id: editMeter.id });
    } else {
      await db.meters.add(data as Meter);
    }

    setShowForm(false);
    setEditMeter(null);
    setForm(EMPTY_FORM);
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    await db.meterReadings
      .where('[meterId+date]')
      .between([deleteTarget.id, ''], [deleteTarget.id, '\uffff'])
      .delete();
    await db.meters.delete(deleteTarget.id);
    setDeleteTarget(null);
    setShowForm(false);
    setEditMeter(null);
  };

  const getCalibrationStatus = (meter: Meter): { status: 'green' | 'yellow' | 'red' | 'gray'; label: string } => {
    if (!meter.calibrationDue) return { status: 'gray', label: 'Keine Eichfrist' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(meter.calibrationDue + 'T00:00:00');
    const diffMs = due.getTime() - today.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0) return { status: 'red', label: 'Abgelaufen' };
    if (days <= 90) return { status: 'yellow', label: `${days} Tage` };
    return { status: 'green', label: 'OK' };
  };

  const makeColumns = (): Column<MeterRow>[] => [
    {
      key: 'serial',
      header: 'Seriennr.',
      render: (r) => <span className="font-mono text-xs">{r.meter.serialNumber}</span>,
      sortValue: (r) => r.meter.serialNumber,
    },
    {
      key: 'type',
      header: 'Zählertyp',
      render: (r) => r.meterType.name,
      sortValue: (r) => r.meterType.name,
    },
    {
      key: 'location',
      header: 'Zuordnung',
      render: (r) =>
        r.unit ? (
          r.unit.name
        ) : (
          <span className="text-stone-500 dark:text-stone-400 italic">Hauptzähler</span>
        ),
      sortValue: (r) => r.unit?.name ?? '',
    },
    {
      key: 'lastReading',
      header: 'Letzter Stand',
      render: (r) =>
        r.lastReading ? (
          <span className="font-mono text-xs">
            {formatNumber(r.lastReading.value)} {r.meterType.unit}
            <span className="text-stone-400 dark:text-stone-500 ml-1">
              ({formatDate(r.lastReading.date)})
            </span>
          </span>
        ) : (
          <span className="text-stone-400 dark:text-stone-500">–</span>
        ),
      sortValue: (r) => r.lastReading?.value ?? 0,
      align: 'right',
    },
    {
      key: 'calibration',
      header: 'Eichfrist',
      render: (r) => {
        const { status, label } = getCalibrationStatus(r.meter);
        return (
          <div className="flex items-center gap-2">
            {r.meter.calibrationDue && (
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {formatDate(r.meter.calibrationDue)}
              </span>
            )}
            <StatusBadge status={status} label={label} />
          </div>
        );
      },
      sortValue: (r) => r.meter.calibrationDue ?? 'zzzz',
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(r.meter);
            }}
            className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200"
          >
            Bearbeiten
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(r.meter);
            }}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Löschen
          </button>
        </div>
      ),
    },
  ];

  const formContent = (
    <div className="mb-4 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-200 dark:border-stone-700">
      <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-3">
        {editMeter ? 'Zähler bearbeiten' : 'Neuer Zähler'}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
            Zählertyp *
          </label>
          <select
            value={form.meterTypeId}
            onChange={(e) => setForm({ ...form, meterTypeId: e.target.value })}
            className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
          >
            <option value="">– Typ wählen –</option>
            {meterTypes.map((mt) => (
              <option key={mt.id!} value={mt.id!}>
                {mt.name} ({mt.unit})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
            Seriennummer *
          </label>
          <input
            type="text"
            value={form.serialNumber}
            onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
            placeholder="z.B. WZ-2024-001"
            className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
            Zuordnung
          </label>
          <select
            value={form.unitId}
            onChange={(e) => setForm({ ...form, unitId: e.target.value })}
            className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
          >
            <option value="">Hauptzähler (kein Wohnungsbezug)</option>
            {units.map((u) => (
              <option key={u.id!} value={u.id!}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
            Einbaudatum
          </label>
          <input
            type="date"
            value={form.installDate}
            onChange={(e) => setForm({ ...form, installDate: e.target.value })}
            className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
            Eichfrist bis
          </label>
          <input
            type="date"
            value={form.calibrationDue}
            onChange={(e) => setForm({ ...form, calibrationDue: e.target.value })}
            className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
            Notizen
          </label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optionale Bemerkungen"
            className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSave}
          disabled={!form.meterTypeId || !form.serialNumber.trim()}
          className="px-4 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Speichern
        </button>
        <button
          onClick={() => {
            setShowForm(false);
            setEditMeter(null);
          }}
          className="px-4 py-1.5 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Card
        title="Zähler-Übersicht"
        action={
          <button
            onClick={handleOpenAdd}
            className="text-sm px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            + Zähler
          </button>
        }
      >
        {showForm && formContent}

        {hauptzaehler.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2">
              Hauptzähler
            </h3>
            <DataTable
              columns={makeColumns()}
              data={hauptzaehler}
              keyFn={(r) => r.meter.id!}
            />
          </div>
        )}

        {wohnungszaehler.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2">
              Wohnungszähler
            </h3>
            <DataTable
              columns={makeColumns()}
              data={wohnungszaehler}
              keyFn={(r) => r.meter.id!}
            />
          </div>
        )}

        {(!meterRows || meterRows.length === 0) && !showForm && (
          <EmptyState
            icon="🔢"
            title="Keine Zähler"
            description="Legen Sie Ihre Zähler an, um Ablesungen zu erfassen."
            action={{ label: 'Zähler anlegen', onClick: handleOpenAdd }}
          />
        )}
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Zähler löschen"
        message={`Möchten Sie den Zähler „${deleteTarget?.serialNumber ?? ''}" wirklich löschen? Alle zugehörigen Ablesungen werden ebenfalls gelöscht.`}
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
