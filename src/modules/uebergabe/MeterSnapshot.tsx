import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';

interface MeterReading {
  meterId: number;
  value: number;
}

interface MeterSnapshot {
  meterId: number;
  meterTypeId: number;
  typeName: string;
  typeUnit: string;
  serialNumber: string;
  lastReading: number | null;
  value: number;
}

interface MeterSnapshotProps {
  unitId: number;
  readings: MeterReading[];
  onChange: (readings: MeterReading[]) => void;
}

export function MeterSnapshot({ unitId, readings, onChange }: MeterSnapshotProps) {
  const snapshots = useLiveQuery(async () => {
    const meters = await db.meters.where('unitId').equals(unitId).toArray();
    const results: MeterSnapshot[] = [];

    for (const meter of meters) {
      const meterType = await db.meterTypes.get(meter.meterTypeId);
      const allReadings = await db.meterReadings
        .where('[meterId+date]')
        .between([meter.id!, ''], [meter.id!, '\uffff'])
        .toArray();

      const sorted = allReadings.sort((a, b) => b.date.localeCompare(a.date));
      const lastReading = sorted.length > 0 ? sorted[0].value : null;

      results.push({
        meterId: meter.id!,
        meterTypeId: meter.meterTypeId,
        typeName: meterType?.name ?? 'Unbekannt',
        typeUnit: meterType?.unit ?? '',
        serialNumber: meter.serialNumber,
        lastReading,
        value: 0,
      });
    }

    return results;
  }, [unitId]);

  // Initialize readings from meters once loaded
  useEffect(() => {
    if (!snapshots || snapshots.length === 0) return;
    if (readings.length > 0) return;

    const initialReadings: MeterReading[] = snapshots.map((s) => ({
      meterId: s.meterId,
      value: s.lastReading ?? 0,
    }));
    onChange(initialReadings);
  }, [snapshots, readings.length, onChange]);

  const updateReading = (meterId: number, value: number) => {
    const updated = readings.map((r) =>
      r.meterId === meterId ? { ...r, value } : r,
    );
    // If meter not yet in readings, add it
    if (!readings.find((r) => r.meterId === meterId)) {
      updated.push({ meterId, value });
    }
    onChange(updated);
  };

  const getReadingValue = (meterId: number): number => {
    return readings.find((r) => r.meterId === meterId)?.value ?? 0;
  };

  if (!snapshots) {
    return (
      <Card>
        <p className="text-sm text-stone-500 dark:text-stone-400">Zähler werden geladen...</p>
      </Card>
    );
  }

  if (snapshots.length === 0) {
    return (
      <Card>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Keine Zähler für diese Wohnung vorhanden. Sie können diesen Schritt
          überspringen oder zuerst Zähler in der Zählerverwaltung anlegen.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {snapshots.map((snapshot) => (
        <Card key={snapshot.meterId}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                  {snapshot.typeName}
                </span>
                <span className="text-xs px-2 py-0.5 bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 rounded-full">
                  {snapshot.typeUnit}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Zähler-Nr.: {snapshot.serialNumber}
              </p>
              {snapshot.lastReading !== null && (
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  Letzter Stand: {snapshot.lastReading.toLocaleString('de-DE')}{' '}
                  {snapshot.typeUnit}
                </p>
              )}
            </div>

            <div className="sm:w-48">
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                Aktueller Stand
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={getReadingValue(snapshot.meterId) || ''}
                  onChange={(e) =>
                    updateReading(
                      snapshot.meterId,
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
                />
                <span className="text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">
                  {snapshot.typeUnit}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
