import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { SupplierBill, Unit, Meter, MeterType, MeterReading, Occupancy } from '../../db/schema';
// Meter, MeterType, MeterReading, Occupancy used in allData query result type
import { Card } from '../../components/shared/Card';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatNumber } from '../../utils/format';
import { useProperty } from '../../hooks/useProperty';
import { waterPerCapitaPerDay } from '../../utils/calc';
import {
  WATER_AVG_LITERS_PER_PERSON_DAY,
  WATER_DIFF_THRESHOLD_WARN,
  WARM_WATER_RATIO_MIN,
  WARM_WATER_RATIO_MAX,
} from '../../utils/constants';

interface AnomalyAlertsProps {
  year: number;
}

interface Anomaly {
  type: 'difference' | 'per-capita' | 'warm-ratio';
  severity: 'yellow' | 'red';
  title: string;
  description: string;
  unitName?: string;
}

export function AnomalyAlerts({ year }: AnomalyAlertsProps) {
  const { activeProperty } = useProperty();
  const propertyId = activeProperty?.id;

  const supplierBills = useLiveQuery(
    () =>
      propertyId != null
        ? db.supplierBills
            .where('[year+type]')
            .equals([year, 'water'])
            .filter((b) => b.propertyId === propertyId)
            .toArray()
        : Promise.resolve([] as SupplierBill[]),
    [year, propertyId],
  );

  const units = useLiveQuery(
    () =>
      propertyId != null
        ? db.units.where('propertyId').equals(propertyId).toArray()
        : Promise.resolve([] as Unit[]),
    [propertyId],
  );

  const allMeterTypes = useLiveQuery(() => db.meterTypes.toArray(), []);

  const allData = useLiveQuery(
    async () => {
      if (!units || units.length === 0 || !allMeterTypes || allMeterTypes.length === 0) {
        return null;
      }

      const waterTypes = allMeterTypes.filter((mt) => mt.category === 'water');
      if (waterTypes.length === 0) return null;

      const waterTypeIds = waterTypes.map((mt) => mt.id!);
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      const yearStartMonth = `${year}-01`;
      const yearEndMonth = `${year}-12`;

      const result: {
        unit: Unit;
        meters: (Meter & { meterType: MeterType })[];
        readings: MeterReading[];
        occupancies: Occupancy[];
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

        const allOccupancies = await db.occupancies
          .where('unitId')
          .equals(unit.id!)
          .toArray();

        const occupancies = allOccupancies.filter(
          (o) => o.from <= yearEndMonth && (o.to === null || o.to >= yearStartMonth),
        );

        result.push({ unit, meters: metersWithTypes, readings, occupancies });
      }

      return result;
    },
    [units, allMeterTypes, year],
  );

  const anomalies = useMemo((): Anomaly[] => {
    const results: Anomaly[] = [];

    // 1. High difference check
    if (supplierBills && supplierBills.length > 0 && allData) {
      const supplierTotal = supplierBills.reduce(
        (sum, b) => sum + b.totalConsumption,
        0,
      );

      let messdienstTotal = 0;
      for (const { meters, readings } of allData) {
        for (const meter of meters) {
          const meterReadings = readings
            .filter((r) => r.meterId === meter.id!)
            .sort((a, b) => a.date.localeCompare(b.date));

          if (meterReadings.length >= 2) {
            const first = meterReadings[0];
            const last = meterReadings[meterReadings.length - 1];
            messdienstTotal += last.value - first.value;
          }
        }
      }

      if (supplierTotal > 0) {
        const diffPercent =
          (Math.abs(supplierTotal - messdienstTotal) / supplierTotal) * 100;
        if (diffPercent > WATER_DIFF_THRESHOLD_WARN) {
          results.push({
            type: 'difference',
            severity: 'red',
            title: 'Hohe Differenz Versorger/Messdienstleister',
            description: `Die Differenz zwischen Versorger- und Zählerverbrauch beträgt ${formatNumber(diffPercent)} % und liegt über dem Schwellwert von ${WATER_DIFF_THRESHOLD_WARN} %. Mögliche Ursachen: Leckage, defekte Zähler oder fehlende Ablesungen.`,
          });
        }
      }
    }

    // 2. Per-capita check and warm-ratio check per unit
    if (allData) {
      for (const { unit, meters, readings, occupancies } of allData) {
        // Calculate total water consumption
        let totalConsumption = 0;
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
            totalConsumption += consumption;

            const typeName = meter.meterType.name.toLowerCase();
            if (typeName.includes('warm')) {
              warmTotal += consumption;
            } else {
              coldTotal += consumption;
            }
          }
        }

        // Per-capita check
        if (totalConsumption > 0 && occupancies.length > 0) {
          const yearStartMonth = `${year}-01`;
          const yearEndMonth = `${year}-12`;
          let totalPersonMonths = 0;

          for (const occ of occupancies) {
            const start = occ.from < yearStartMonth ? yearStartMonth : occ.from;
            const end = occ.to === null || occ.to > yearEndMonth ? yearEndMonth : occ.to;
            const [y1, m1] = start.split('-').map(Number);
            const [y2, m2] = end.split('-').map(Number);
            const months = Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
            totalPersonMonths += months * occ.persons;
          }

          if (totalPersonMonths > 0) {
            const avgPersons = totalPersonMonths / 12;
            const lpd = waterPerCapitaPerDay(totalConsumption, avgPersons, 365);
            const deviation =
              ((lpd - WATER_AVG_LITERS_PER_PERSON_DAY) /
                WATER_AVG_LITERS_PER_PERSON_DAY) *
              100;

            if (deviation > 44) {
              results.push({
                type: 'per-capita',
                severity: 'red',
                title: `Hoher Pro-Kopf-Verbrauch: ${unit.name}`,
                description: `Der Verbrauch von ${formatNumber(lpd)} l/Person/Tag liegt ${formatNumber(deviation)} % über dem Bundesdurchschnitt (${WATER_AVG_LITERS_PER_PERSON_DAY} l). Mögliche Ursachen: undichte Armaturen, hoher Gartenbewässerungsbedarf oder fehlerhafte Zähler.`,
                unitName: unit.name,
              });
            }
          }
        }

        // Warm water ratio check
        const totalWaterForRatio = warmTotal + coldTotal;
        if (totalWaterForRatio > 0) {
          const warmPercent = (warmTotal / totalWaterForRatio) * 100;
          if (warmPercent > 50) {
            results.push({
              type: 'warm-ratio',
              severity: 'red',
              title: `Ungewöhnlicher Warmwasseranteil: ${unit.name}`,
              description: `Der Warmwasseranteil beträgt ${formatNumber(warmPercent)} % und liegt deutlich über dem Normalbereich (${WARM_WATER_RATIO_MIN}–${WARM_WATER_RATIO_MAX} %). Mögliche Ursachen: defekter Kaltwasserzähler, ungewöhnliches Nutzungsverhalten oder Zählervertauschung.`,
              unitName: unit.name,
            });
          }
        }
      }
    }

    return results;
  }, [supplierBills, allData, year]);

  if (anomalies.length === 0) {
    return (
      <Card title="Hinweise / Anomalien">
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
          <StatusBadge status="green" label="Alles in Ordnung" />
          <p className="text-sm text-green-700">
            Es wurden keine Anomalien im Wasserverbrauch festgestellt.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Hinweise / Anomalien">
      <div className="space-y-3">
        {anomalies.map((anomaly, index) => (
          <div
            key={`${anomaly.type}-${anomaly.unitName ?? ''}-${index}`}
            className={`p-4 rounded-lg border ${
              anomaly.severity === 'red'
                ? 'bg-red-50 border-red-200'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <StatusBadge
                  status={anomaly.severity}
                  label={
                    anomaly.severity === 'red' ? 'Warnung' : 'Hinweis'
                  }
                />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-stone-800 mb-1">
                  {anomaly.title}
                </h4>
                <p className="text-sm text-stone-600">{anomaly.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
