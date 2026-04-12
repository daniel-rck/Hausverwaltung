import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Unit, Occupancy, Meter, MeterReading } from '../../db/schema';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { BarChart } from '../../components/charts/BarChart';
import { formatNumber } from '../../utils/format';
import { useProperty } from '../../hooks/useProperty';
import { waterPerCapitaPerDay } from '../../utils/calc';
import { WATER_AVG_LITERS_PER_PERSON_DAY } from '../../utils/constants';

interface ProKopfChartProps {
  year: number;
}

interface UnitConsumption {
  unitName: string;
  litersPerPersonPerDay: number;
  persons: number;
  consumptionM3: number;
}

export function ProKopfChart({ year }: ProKopfChartProps) {
  const { activeProperty } = useProperty();
  const propertyId = activeProperty?.id;

  const units = useLiveQuery(
    () =>
      propertyId != null
        ? db.units.where('propertyId').equals(propertyId).toArray()
        : Promise.resolve([] as Unit[]),
    [propertyId],
  );

  const waterMeterTypes = useLiveQuery(
    () => db.meterTypes.filter((mt) => mt.category === 'water').toArray(),
    [],
  );

  const allData = useLiveQuery(
    async () => {
      if (!units || units.length === 0 || !waterMeterTypes || waterMeterTypes.length === 0) {
        return null;
      }

      const waterTypeIds = waterMeterTypes.map((mt) => mt.id!);
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      const yearStartMonth = `${year}-01`;
      const yearEndMonth = `${year}-12`;

      const result: {
        unit: Unit;
        meters: Meter[];
        readings: MeterReading[];
        occupancies: Occupancy[];
      }[] = [];

      for (const unit of units) {
        const unitMeters = await db.meters
          .where('unitId')
          .equals(unit.id!)
          .filter((m) => waterTypeIds.includes(m.meterTypeId))
          .toArray();

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

        result.push({ unit, meters: unitMeters, readings, occupancies });
      }

      return result;
    },
    [units, waterMeterTypes, year],
  );

  const unitConsumptions = useMemo((): UnitConsumption[] => {
    if (!allData) return [];

    const results: UnitConsumption[] = [];

    for (const { unit, meters, readings, occupancies } of allData) {
      // Calculate total water consumption for this unit
      let totalConsumption = 0;
      for (const meter of meters) {
        const meterReadings = readings
          .filter((r) => r.meterId === meter.id!)
          .sort((a, b) => a.date.localeCompare(b.date));

        if (meterReadings.length >= 2) {
          const first = meterReadings[0];
          const last = meterReadings[meterReadings.length - 1];
          totalConsumption += last.value - first.value;
        }
      }

      if (totalConsumption <= 0) continue;

      // Calculate weighted average persons across the year
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

      if (totalPersonMonths <= 0) continue;

      const avgPersons = totalPersonMonths / 12;
      const lpd = waterPerCapitaPerDay(totalConsumption, avgPersons, 365);

      results.push({
        unitName: unit.name,
        litersPerPersonPerDay: lpd,
        persons: avgPersons,
        consumptionM3: totalConsumption,
      });
    }

    return results.sort((a, b) => a.unitName.localeCompare(b.unitName));
  }, [allData, year]);

  if (unitConsumptions.length === 0) {
    return (
      <Card title="Pro-Kopf-Verbrauch">
        <EmptyState
          icon="🚿"
          title="Keine Verbrauchsdaten"
          description="Es liegen keine ausreichenden Zählerablesungen und Belegungsdaten für die Pro-Kopf-Analyse vor."
        />
      </Card>
    );
  }

  const labels = unitConsumptions.map((u) => u.unitName);
  const dataValues = unitConsumptions.map((u) =>
    Math.round(u.litersPerPersonPerDay * 100) / 100,
  );
  const referenceLineData = unitConsumptions.map(
    () => WATER_AVG_LITERS_PER_PERSON_DAY,
  );

  return (
    <Card title="Pro-Kopf-Verbrauch">
      <p className="text-sm text-stone-600 mb-4">
        Liter pro Person pro Tag nach Wohneinheit. Bundesdurchschnitt:{' '}
        <span className="font-semibold">{WATER_AVG_LITERS_PER_PERSON_DAY} l/Person/Tag</span>
      </p>

      <div className="mb-4">
        <BarChart
          labels={labels}
          datasets={[
            {
              label: 'Verbrauch (l/Person/Tag)',
              data: dataValues,
              color: '#0891b2',
            },
            {
              label: `Durchschnitt (${WATER_AVG_LITERS_PER_PERSON_DAY} l)`,
              data: referenceLineData,
              color: '#d4d4d4',
            },
          ]}
          height={250}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="py-2 px-3 text-left font-medium text-stone-500">
                Einheit
              </th>
              <th className="py-2 px-3 text-right font-medium text-stone-500">
                Personen
              </th>
              <th className="py-2 px-3 text-right font-medium text-stone-500">
                Verbrauch (m³)
              </th>
              <th className="py-2 px-3 text-right font-medium text-stone-500">
                l/Person/Tag
              </th>
              <th className="py-2 px-3 text-right font-medium text-stone-500">
                Abweichung
              </th>
            </tr>
          </thead>
          <tbody>
            {unitConsumptions.map((uc) => {
              const deviation =
                ((uc.litersPerPersonPerDay - WATER_AVG_LITERS_PER_PERSON_DAY) /
                  WATER_AVG_LITERS_PER_PERSON_DAY) *
                100;
              const isHigh = deviation > 44;
              return (
                <tr
                  key={uc.unitName}
                  className="border-b border-stone-100"
                >
                  <td className="py-2.5 px-3">{uc.unitName}</td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {formatNumber(uc.persons)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {formatNumber(uc.consumptionM3)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono ${
                      isHigh ? 'text-red-600 font-semibold' : ''
                    }`}
                  >
                    {formatNumber(uc.litersPerPersonPerDay)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono ${
                      isHigh ? 'text-red-600 font-semibold' : deviation > 0 ? 'text-amber-600' : 'text-green-600'
                    }`}
                  >
                    {deviation >= 0 ? '+' : ''}
                    {formatNumber(deviation)} %
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export type { UnitConsumption };
