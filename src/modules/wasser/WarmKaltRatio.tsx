import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Unit, Meter, MeterType, MeterReading } from '../../db/schema';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { BarChart } from '../../components/charts/BarChart';
import { formatNumber } from '../../utils/format';
import { useProperty } from '../../hooks/useProperty';
import { WARM_WATER_RATIO_MIN, WARM_WATER_RATIO_MAX } from '../../utils/constants';

interface WarmKaltRatioProps {
  year: number;
}

interface UnitRatio {
  unitName: string;
  warmM3: number;
  coldM3: number;
  totalM3: number;
  warmPercent: number;
  status: 'green' | 'yellow' | 'red';
  statusLabel: string;
}

function getRatioStatus(warmPercent: number): { status: 'green' | 'yellow' | 'red'; label: string } {
  if (warmPercent >= WARM_WATER_RATIO_MIN && warmPercent <= WARM_WATER_RATIO_MAX) {
    return { status: 'green', label: 'Normal' };
  }
  if (warmPercent > 50) {
    return { status: 'red', label: 'Zu hoch' };
  }
  if (warmPercent > WARM_WATER_RATIO_MAX) {
    return { status: 'yellow', label: 'Leicht erhöht' };
  }
  if (warmPercent < WARM_WATER_RATIO_MIN && warmPercent >= 20) {
    return { status: 'yellow', label: 'Leicht niedrig' };
  }
  return { status: 'red', label: 'Auffällig' };
}

export function WarmKaltRatio({ year }: WarmKaltRatioProps) {
  const { activeProperty } = useProperty();
  const propertyId = activeProperty?.id;

  const units = useLiveQuery(
    () =>
      propertyId != null
        ? db.units.where('propertyId').equals(propertyId).toArray()
        : Promise.resolve([] as Unit[]),
    [propertyId],
  );

  const meterTypes = useLiveQuery(() => db.meterTypes.toArray(), []);

  const allData = useLiveQuery(
    async () => {
      if (!units || units.length === 0 || !meterTypes || meterTypes.length === 0) {
        return null;
      }

      const waterTypes = meterTypes.filter((mt) => mt.category === 'water');
      if (waterTypes.length === 0) return null;

      const waterTypeIds = waterTypes.map((mt) => mt.id!);
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const result: {
        unit: Unit;
        meters: (Meter & { meterType: MeterType })[];
        readings: MeterReading[];
      }[] = [];

      for (const unit of units) {
        const unitMeters = await db.meters
          .where('unitId')
          .equals(unit.id!)
          .filter((m) => waterTypeIds.includes(m.meterTypeId))
          .toArray();

        const metersWithTypes = unitMeters.map((m) => ({
          ...m,
          meterType: waterTypes.find((mt) => mt.id === m.meterTypeId)!,
        }));

        const readings: MeterReading[] = [];
        for (const meter of unitMeters) {
          const meterReadings = await db.meterReadings
            .where('[meterId+date]')
            .between([meter.id!, yearStart], [meter.id!, yearEnd], true, true)
            .toArray();
          readings.push(...meterReadings);
        }

        result.push({ unit, meters: metersWithTypes, readings });
      }

      return result;
    },
    [units, meterTypes, year],
  );

  const unitRatios = useMemo((): UnitRatio[] => {
    if (!allData) return [];

    const results: UnitRatio[] = [];

    for (const { unit, meters, readings } of allData) {
      let warmTotal = 0;
      let coldTotal = 0;

      for (const meter of meters) {
        const meterReadings = readings
          .filter((r) => r.meterId === meter.id!)
          .sort((a, b) => a.date.localeCompare(b.date));

        if (meterReadings.length >= 2) {
          const first = meterReadings[0];
          const last = meterReadings[meterReadings.length - 1];
          const consumption = last.value - first.value;

          const typeName = meter.meterType.name.toLowerCase();
          if (typeName.includes('warm')) {
            warmTotal += consumption;
          } else {
            coldTotal += consumption;
          }
        }
      }

      const totalM3 = warmTotal + coldTotal;
      if (totalM3 <= 0) continue;

      const warmPercent = (warmTotal / totalM3) * 100;
      const { status, label } = getRatioStatus(warmPercent);

      results.push({
        unitName: unit.name,
        warmM3: warmTotal,
        coldM3: coldTotal,
        totalM3,
        warmPercent,
        status,
        statusLabel: label,
      });
    }

    return results.sort((a, b) => a.unitName.localeCompare(b.unitName));
  }, [allData]);

  if (unitRatios.length === 0) {
    return (
      <Card title="Warm/Kalt-Verhältnis">
        <EmptyState
          icon="🌡️"
          title="Keine Daten vorhanden"
          description="Es werden Warm- und Kaltwasserzähler mit Ablesungen benötigt, um das Verhältnis zu berechnen."
        />
      </Card>
    );
  }

  const labels = unitRatios.map((u) => u.unitName);

  return (
    <Card title="Warm/Kalt-Verhältnis">
      <p className="text-sm text-stone-600 dark:text-stone-300 mb-4">
        Anteil Warmwasser am Gesamtverbrauch pro Einheit. Normalbereich:{' '}
        <span className="font-semibold">
          {WARM_WATER_RATIO_MIN}–{WARM_WATER_RATIO_MAX} %
        </span>
      </p>

      <div className="mb-4">
        <BarChart
          labels={labels}
          datasets={[
            {
              label: 'Warmwasser (m³)',
              data: unitRatios.map((u) => Math.round(u.warmM3 * 100) / 100),
              color: '#dc2626',
            },
            {
              label: 'Kaltwasser (m³)',
              data: unitRatios.map((u) => Math.round(u.coldM3 * 100) / 100),
              color: '#0891b2',
            },
          ]}
          stacked
          height={250}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 dark:border-stone-700">
              <th className="py-2 px-3 text-left font-medium text-stone-500 dark:text-stone-400">
                Einheit
              </th>
              <th className="py-2 px-3 text-right font-medium text-stone-500 dark:text-stone-400">
                Warmwasser (m³)
              </th>
              <th className="py-2 px-3 text-right font-medium text-stone-500 dark:text-stone-400">
                Kaltwasser (m³)
              </th>
              <th className="py-2 px-3 text-right font-medium text-stone-500 dark:text-stone-400">
                Gesamt (m³)
              </th>
              <th className="py-2 px-3 text-right font-medium text-stone-500 dark:text-stone-400">
                Warmanteil
              </th>
              <th className="py-2 px-3 text-center font-medium text-stone-500 dark:text-stone-400">
                Bewertung
              </th>
            </tr>
          </thead>
          <tbody>
            {unitRatios.map((ur) => (
              <tr key={ur.unitName} className="border-b border-stone-100 dark:border-stone-700">
                <td className="py-2.5 px-3">{ur.unitName}</td>
                <td className="py-2.5 px-3 text-right font-mono">
                  {formatNumber(ur.warmM3)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono">
                  {formatNumber(ur.coldM3)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono">
                  {formatNumber(ur.totalM3)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono">
                  {formatNumber(ur.warmPercent)} %
                </td>
                <td className="py-2.5 px-3 text-center">
                  <StatusBadge status={ur.status} label={ur.statusLabel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export type { UnitRatio };
