import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { BarChart } from '../../components/charts/BarChart';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatEuro, MONTH_NAMES } from '../../utils/format';

interface RevenueChartProps {
  year: number;
}

export function RevenueChart({ year }: RevenueChartProps) {
  const { activeProperty } = useProperty();

  const data = useLiveQuery(async () => {
    if (!activeProperty?.id) return null;

    const units = await db.units
      .where('propertyId')
      .equals(activeProperty.id)
      .toArray();

    const unitIds = units.map((u) => u.id!);
    const allOccupancies = await db.occupancies.toArray();
    const occupancies = allOccupancies.filter((o) => unitIds.includes(o.unitId));

    const allPayments = await db.payments.toArray();

    return { occupancies, allPayments };
  }, [activeProperty?.id]);

  const chartData = useMemo(() => {
    if (!data) return null;

    const { occupancies, allPayments } = data;
    const expected: number[] = new Array(12).fill(0) as number[];
    const received: number[] = new Array(12).fill(0) as number[];

    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;

    // Calculate expected per month from occupancies
    for (const occ of occupancies) {
      if (occ.from > yearEnd || (occ.to !== null && occ.to < yearStart))
        continue;

      const monthlyRent = occ.rentCold + occ.rentUtilities;

      for (let m = 1; m <= 12; m++) {
        const month = `${year}-${String(m).padStart(2, '0')}`;
        if (month < occ.from) continue;
        if (occ.to !== null && month > occ.to) continue;
        expected[m - 1] += monthlyRent;
      }
    }

    // Calculate received per month from payments
    const occupancyIds = new Set(occupancies.map((o) => o.id!));
    for (const p of allPayments) {
      if (!occupancyIds.has(p.occupancyId)) continue;
      if (!p.month.startsWith(`${year}-`)) continue;

      const monthIndex = parseInt(p.month.slice(5), 10) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        received[monthIndex] += p.amountCold + p.amountUtilities;
      }
    }

    const totalExpected = expected.reduce((a, b) => a + b, 0);
    const totalReceived = received.reduce((a, b) => a + b, 0);

    return { expected, received, totalExpected, totalReceived };
  }, [data, year]);

  if (!data || !chartData) return null;

  const hasData =
    chartData.totalExpected > 0 || chartData.totalReceived > 0;

  return (
    <Card
      title="Jahresübersicht"
      action={
        hasData ? (
          <div className="flex gap-4 text-xs text-stone-500">
            <span>
              Soll:{' '}
              <strong className="text-stone-700">
                {formatEuro(chartData.totalExpected)}
              </strong>
            </span>
            <span>
              Ist:{' '}
              <strong
                className={
                  chartData.totalReceived >= chartData.totalExpected
                    ? 'text-green-600'
                    : 'text-amber-600'
                }
              >
                {formatEuro(chartData.totalReceived)}
              </strong>
            </span>
          </div>
        ) : undefined
      }
    >
      {!hasData ? (
        <EmptyState
          icon="📊"
          title="Keine Daten"
          description={`Für ${year} liegen keine Mietdaten vor.`}
        />
      ) : (
        <div className="h-[300px]">
          <BarChart
            labels={MONTH_NAMES.map((n) => n.slice(0, 3))}
            datasets={[
              {
                label: 'Soll',
                data: chartData.expected,
                color: '#d6d3d1',
              },
              {
                label: 'Ist',
                data: chartData.received,
                color: '#16a34a',
              },
            ]}
            height={300}
          />
        </div>
      )}
    </Card>
  );
}
