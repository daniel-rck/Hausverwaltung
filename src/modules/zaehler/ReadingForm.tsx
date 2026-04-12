import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { NumInput } from '../../components/shared/NumInput';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { formatDate, formatNumber } from '../../utils/format';
import type { Meter, MeterType, MeterReading, Unit } from '../../db/schema';

interface MeterOption {
  meter: Meter;
  meterType: MeterType;
  unit: Unit | null;
  label: string;
}

const SOURCE_LABELS: Record<MeterReading['source'], string> = {
  self: 'Eigene Ablesung',
  messdienst: 'Messdienstleister',
  versorger: 'Versorger',
};

interface ReadingFormProps {
  selectedMeterId: number | null;
  onMeterChange: (meterId: number | null) => void;
}

export function ReadingForm({ selectedMeterId, onMeterChange }: ReadingFormProps) {
  const { activeProperty } = useProperty();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [value, setValue] = useState(0);
  const [source, setSource] = useState<MeterReading['source']>('self');
  const [saving, setSaving] = useState(false);

  const meterOptions = useLiveQuery(async (): Promise<MeterOption[]> => {
    if (!activeProperty?.id) return [];

    const units = await db.units
      .where('propertyId')
      .equals(activeProperty.id)
      .toArray();
    const unitIds = units.map((u) => u.id!);
    const unitMap = new Map(units.map((u) => [u.id!, u]));

    const allMeters = await db.meters.toArray();
    const propertyMeters = allMeters.filter(
      (m) => m.unitId === null || unitIds.includes(m.unitId),
    );

    const meterTypes = await db.meterTypes.toArray();
    const typeMap = new Map(meterTypes.map((t) => [t.id!, t]));

    return propertyMeters.map((meter) => {
      const mt = typeMap.get(meter.meterTypeId);
      const unit = meter.unitId ? unitMap.get(meter.unitId) ?? null : null;
      const locationLabel = unit ? unit.name : 'Hauptzähler';
      return {
        meter,
        meterType: mt ?? { id: 0, name: 'Unbekannt', unit: '', category: 'water' as const },
        unit,
        label: `${mt?.name ?? 'Unbekannt'} – ${meter.serialNumber} (${locationLabel})`,
      };
    });
  }, [activeProperty?.id]);

  const recentReadings = useLiveQuery(async () => {
    if (!selectedMeterId) return [];
    return db.meterReadings
      .where('[meterId+date]')
      .between([selectedMeterId, ''], [selectedMeterId, '\uffff'])
      .reverse()
      .limit(10)
      .sortBy('date')
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
      setSource('self');
    } finally {
      setSaving(false);
    }
  };

  const readingColumns: Column<MeterReading>[] = [
    {
      key: 'date',
      header: 'Datum',
      render: (r) => formatDate(r.date),
      sortValue: (r) => r.date,
    },
    {
      key: 'value',
      header: 'Zählerstand',
      render: (r) => (
        <span className="font-mono">
          {formatNumber(r.value)} {selectedMeterType?.unit ?? ''}
        </span>
      ),
      sortValue: (r) => r.value,
      align: 'right',
    },
    {
      key: 'source',
      header: 'Quelle',
      render: (r) => SOURCE_LABELS[r.source],
    },
  ];

  return (
    <Card title="Ablesung erfassen">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
              Zähler *
            </label>
            <select
              value={selectedMeterId ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onMeterChange(val ? Number(val) : null);
              }}
              className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
            >
              <option value="">– Zähler wählen –</option>
              {(meterOptions ?? []).map((opt) => (
                <option key={opt.meter.id!} value={opt.meter.id!}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
              Datum *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumInput
            value={value}
            onChange={setValue}
            label={`Zählerstand${selectedMeterType?.unit ? ` (${selectedMeterType.unit})` : ''} *`}
            suffix={selectedMeterType?.unit}
            min={0}
          />
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
              Quelle *
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as MeterReading['source'])}
              className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
            >
              <option value="self">Eigene Ablesung</option>
              <option value="messdienst">Messdienstleister</option>
              <option value="versorger">Versorger</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!selectedMeterId || !date || saving}
            className="px-4 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Speichere...' : 'Ablesung speichern'}
          </button>
        </div>

        {selectedMeterId && (
          <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-700">
            <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-2">
              Letzte Ablesungen
            </h3>
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
