import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';
import { LineChart } from '../../components/charts/LineChart';
import type { FinancingData } from './FinancingInput';

interface CashflowChartProps {
  propertyId: number;
}

export function CashflowChart({ propertyId }: CashflowChartProps) {
  const chartData = useLiveQuery(async () => {
    const setting = await db.settings.get(`financing_${propertyId}`);
    const financing = (setting?.value as FinancingData) ?? null;

    const jaehrlicheKreditrate = financing?.jaehrlicheKreditrate ?? 0;
    const nichtUmlagefaehig = financing?.nichtUmlagefaehigeKosten ?? 0;

    const units = await db.units
      .where('propertyId')
      .equals(propertyId)
      .toArray();
    const unitIds = units.map((u) => u.id!);

    if (unitIds.length === 0) {
      return { labels: [], einnahmen: [], cashflow: [] };
    }

    // Get all occupancies for this property's units
    const allOccupancies = await db.occupancies.toArray();
    const propertyOccupancies = allOccupancies.filter((o) =>
      unitIds.includes(o.unitId),
    );
    const occupancyIds = propertyOccupancies.map((o) => o.id!);

    // Get all payments for those occupancies
    const allPayments = await db.payments.toArray();
    const propertyPayments = allPayments.filter((p) =>
      occupancyIds.includes(p.occupancyId),
    );

    // Group payments by year
    const paymentsByYear = new Map<number, number>();
    for (const p of propertyPayments) {
      const year = parseInt(p.month.slice(0, 4), 10);
      const current = paymentsByYear.get(year) ?? 0;
      paymentsByYear.set(year, current + p.amountCold + p.amountUtilities);
    }

    // Determine the range: last 5 years or available data
    const currentYear = new Date().getFullYear();
    const allYears = Array.from(paymentsByYear.keys());
    const minYear = allYears.length > 0
      ? Math.min(...allYears)
      : currentYear - 4;
    const startYear = Math.max(minYear, currentYear - 4);

    const labels: string[] = [];
    const einnahmen: number[] = [];
    const cashflowValues: number[] = [];

    for (let y = startYear; y <= currentYear; y++) {
      labels.push(String(y));
      const income = paymentsByYear.get(y) ?? 0;
      einnahmen.push(income);
      cashflowValues.push(income - jaehrlicheKreditrate - nichtUmlagefaehig);
    }

    return { labels, einnahmen, cashflow: cashflowValues };
  }, [propertyId]);

  if (!chartData || chartData.labels.length === 0) {
    return (
      <Card title="Cashflow-Entwicklung">
        <p className="text-sm text-stone-500 text-center py-8">
          Noch keine Zahlungsdaten vorhanden.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Cashflow-Entwicklung">
      <LineChart
        labels={chartData.labels}
        datasets={[
          {
            label: 'Mieteinnahmen',
            data: chartData.einnahmen,
            color: '#16a34a',
          },
          {
            label: 'Cashflow',
            data: chartData.cashflow,
            color: '#0891b2',
          },
        ]}
        height={280}
      />
    </Card>
  );
}
