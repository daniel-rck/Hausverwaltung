import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { LineChart } from '../../components/charts/LineChart';
import { formatDate, formatNumber } from '../../utils/format';
import type { MeterType } from '../../db/schema';

interface ConsumptionChartProps {
  meterId: number | null;
}

export function ConsumptionChart({ meterId }: ConsumptionChartProps) {
  const readings = useLiveQuery(async () => {
    if (!meterId) return [];
    return db.meterReadings
      .where('[meterId+date]')
      .between([meterId, ''], [meterId, '\uffff'])
      .sortBy('date');
  }, [meterId]);

  const meterType = useLiveQuery(async (): Promise<MeterType | undefined> => {
    if (!meterId) return undefined;
    const meter = await db.meters.get(meterId);
    if (!meter) return undefined;
    return db.meterTypes.get(meter.meterTypeId);
  }, [meterId]);

  const chartData = useMemo(() => {
    if (!readings || readings.length < 2) return null;

    const labels: string[] = [];
    const data: number[] = [];

    for (let i = 1; i < readings.length; i++) {
      const consumption = readings[i].value - readings[i - 1].value;
      labels.push(formatDate(readings[i].date));
      data.push(Math.max(0, consumption));
    }

    return { labels, data };
  }, [readings]);

  if (!meterId) {
    return (
      <Card title="Verbrauchsverlauf">
        <EmptyState
          icon="📊"
          title="Kein Zähler ausgewählt"
          description="Wählen Sie einen Zähler, um den Verbrauchsverlauf anzuzeigen."
        />
      </Card>
    );
  }

  if (!chartData) {
    return (
      <Card title="Verbrauchsverlauf">
        <EmptyState
          icon="📊"
          title="Nicht genug Daten"
          description="Es werden mindestens zwei Ablesungen benötigt, um den Verbrauch zu berechnen."
        />
      </Card>
    );
  }

  const unitLabel = meterType?.unit ?? '';

  return (
    <Card title="Verbrauchsverlauf">
      <div className="mb-3">
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Verbrauch zwischen aufeinanderfolgenden Ablesungen
          {unitLabel ? ` (${unitLabel})` : ''}
        </p>
      </div>
      <LineChart
        labels={chartData.labels}
        datasets={[
          {
            label: `Verbrauch${unitLabel ? ` (${unitLabel})` : ''}`,
            data: chartData.data,
          },
        ]}
        height={250}
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-200 dark:border-stone-700">
              <th className="py-1.5 px-2 text-left font-medium text-stone-500 dark:text-stone-400">
                Zeitraum
              </th>
              <th className="py-1.5 px-2 text-right font-medium text-stone-500 dark:text-stone-400">
                Verbrauch
              </th>
            </tr>
          </thead>
          <tbody>
            {chartData.labels.map((label, i) => (
              <tr key={label} className="border-b border-stone-100 dark:border-stone-700">
                <td className="py-1.5 px-2 text-stone-600 dark:text-stone-300">{label}</td>
                <td className="py-1.5 px-2 text-right font-mono">
                  {formatNumber(chartData.data[i])} {unitLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
