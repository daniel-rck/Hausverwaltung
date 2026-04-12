import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { SupplierBill, Unit, Meter, MeterReading } from '../../db/schema';
import { Card } from '../../components/shared/Card';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EmptyState } from '../../components/shared/EmptyState';
import { BarChart } from '../../components/charts/BarChart';
import { formatNumber } from '../../utils/format';
import { useProperty } from '../../hooks/useProperty';
import {
  WATER_DIFF_THRESHOLD_OK,
  WATER_DIFF_THRESHOLD_WARN,
} from '../../utils/constants';

interface DifferenzAnalyseProps {
  year: number;
}

interface AnalysisResult {
  supplierTotal: number;
  messdienstTotal: number;
  difference: number;
  differencePercent: number;
  status: 'green' | 'yellow' | 'red';
  statusLabel: string;
}

function getDiffStatus(pct: number): { status: 'green' | 'yellow' | 'red'; label: string } {
  if (pct <= WATER_DIFF_THRESHOLD_OK) {
    return { status: 'green', label: 'Im Rahmen' };
  }
  if (pct <= WATER_DIFF_THRESHOLD_WARN) {
    return { status: 'yellow', label: 'Auffällig' };
  }
  return { status: 'red', label: 'Kritisch' };
}

export function DifferenzAnalyse({ year }: DifferenzAnalyseProps) {
  const { activeProperty } = useProperty();
  const propertyId = activeProperty?.id;

  const messdienstName = useLiveQuery(
    () => db.settings.get('messdienstName').then((s) => (s?.value as string) ?? 'Messdienstleister'),
    [],
  );

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

  const waterMeterTypes = useLiveQuery(
    () => db.meterTypes.filter((mt) => mt.category === 'water').toArray(),
    [],
  );

  const metersAndReadings = useLiveQuery(
    async () => {
      if (!units || units.length === 0 || !waterMeterTypes || waterMeterTypes.length === 0) {
        return { meters: [] as Meter[], readings: [] as MeterReading[] };
      }

      const waterTypeIds = waterMeterTypes.map((mt) => mt.id!);
      const unitIds = units.map((u) => u.id!);

      const allMeters = await db.meters.toArray();
      const waterMeters = allMeters.filter(
        (m) => m.unitId != null && unitIds.includes(m.unitId) && waterTypeIds.includes(m.meterTypeId),
      );

      if (waterMeters.length === 0) {
        return { meters: waterMeters, readings: [] as MeterReading[] };
      }

      const meterIds = waterMeters.map((m) => m.id!);
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const allReadings: MeterReading[] = [];
      for (const meterId of meterIds) {
        const readings = await db.meterReadings
          .where('[meterId+date]')
          .between([meterId, yearStart], [meterId, yearEnd], true, true)
          .toArray();
        allReadings.push(...readings);
      }

      return { meters: waterMeters, readings: allReadings };
    },
    [units, waterMeterTypes, year],
  );

  const analysis = useMemo((): AnalysisResult | null => {
    if (!supplierBills || supplierBills.length === 0) return null;
    if (!metersAndReadings) return null;

    const supplierTotal = supplierBills.reduce(
      (sum, b) => sum + b.totalConsumption,
      0,
    );

    const { meters, readings } = metersAndReadings;

    let messdienstTotal = 0;
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

    const difference = Math.abs(supplierTotal - messdienstTotal);
    const differencePercent =
      supplierTotal > 0 ? (difference / supplierTotal) * 100 : 0;
    const { status, label } = getDiffStatus(differencePercent);

    return {
      supplierTotal,
      messdienstTotal,
      difference,
      differencePercent,
      status,
      statusLabel: label,
    };
  }, [supplierBills, metersAndReadings]);

  // Historical data for chart: look at years with supplier bills
  const historicalBills = useLiveQuery(
    () =>
      propertyId != null
        ? db.supplierBills
            .where('propertyId')
            .equals(propertyId)
            .filter((b) => b.type === 'water')
            .toArray()
        : Promise.resolve([] as SupplierBill[]),
    [propertyId],
  );

  const chartData = useMemo(() => {
    if (!historicalBills || historicalBills.length === 0 || !analysis) return null;

    // For now, show the current year comparison
    const labels = [`${year}`];
    return {
      labels,
      datasets: [
        {
          label: 'Versorger (m³)',
          data: [analysis.supplierTotal],
          color: '#0891b2',
        },
        {
          label: `${messdienstName ?? 'Messdienstleister'} (m³)`,
          data: [analysis.messdienstTotal],
          color: '#d97706',
        },
      ],
    };
  }, [historicalBills, analysis, year, messdienstName]);

  if (!analysis) {
    return (
      <Card title="Differenzanalyse">
        <EmptyState
          icon="📊"
          title="Keine Daten vorhanden"
          description="Erfassen Sie zuerst eine Versorger-Rechnung und Zählerablesungen, um die Differenzanalyse durchzuführen."
        />
      </Card>
    );
  }

  return (
    <Card title="Differenzanalyse">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-xs text-stone-500">Versorger gesamt</p>
          <p className="text-lg font-semibold text-stone-800">
            {formatNumber(analysis.supplierTotal)} m³
          </p>
        </div>
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-xs text-stone-500">{messdienstName ?? 'Messdienstleister'} gesamt</p>
          <p className="text-lg font-semibold text-stone-800">
            {formatNumber(analysis.messdienstTotal)} m³
          </p>
        </div>
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-xs text-stone-500">Differenz</p>
          <p className="text-lg font-semibold text-stone-800">
            {formatNumber(analysis.difference)} m³ ({formatNumber(analysis.differencePercent)} %)
          </p>
        </div>
        <div className="bg-stone-50 rounded-lg p-3 flex flex-col justify-center">
          <p className="text-xs text-stone-500 mb-1">Bewertung</p>
          <StatusBadge status={analysis.status} label={analysis.statusLabel} />
        </div>
      </div>

      <p className="text-xs text-stone-500 mb-2">
        Schwellwerte: &lt;{WATER_DIFF_THRESHOLD_OK} % = im Rahmen,{' '}
        {WATER_DIFF_THRESHOLD_OK}–{WATER_DIFF_THRESHOLD_WARN} % = auffällig,{' '}
        &gt;{WATER_DIFF_THRESHOLD_WARN} % = kritisch
      </p>

      {chartData && (
        <div className="mt-4">
          <BarChart
            labels={chartData.labels}
            datasets={chartData.datasets}
            height={220}
          />
        </div>
      )}
    </Card>
  );
}
