import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';
import { DonutChart } from '../../components/charts/DonutChart';
import type { FinancingData } from './FinancingInput';

interface CostDonutProps {
  propertyId: number;
}

export function CostDonut({ propertyId }: CostDonutProps) {
  const donutData = useLiveQuery(async () => {
    const setting = await db.settings.get(`financing_${propertyId}`);
    const financing = (setting?.value as FinancingData) ?? null;

    const jaehrlicheKreditrate = financing?.jaehrlicheKreditrate ?? 0;
    const nichtUmlagefaehig = financing?.nichtUmlagefaehigeKosten ?? 0;

    // Annual rent from active occupancies
    const now = new Date().toISOString().slice(0, 10);
    const units = await db.units
      .where('propertyId')
      .equals(propertyId)
      .toArray();
    const unitIds = units.map((u) => u.id!);

    let annualRent = 0;
    if (unitIds.length > 0) {
      const allOccupancies = await db.occupancies.toArray();
      const active = allOccupancies.filter(
        (o) =>
          unitIds.includes(o.unitId) &&
          o.from <= now &&
          (o.to === null || o.to >= now),
      );
      annualRent = active.reduce((sum, o) => sum + o.rentCold * 12, 0);
    }

    // Maintenance costs for current year
    const currentYear = new Date().getFullYear();
    const allMaintenance = await db.maintenanceItems.toArray();
    const propertyMaintenance = allMaintenance.filter((m) => {
      if (m.unitId === null) return false;
      return unitIds.includes(m.unitId) &&
        m.date.startsWith(String(currentYear));
    });
    const instandhaltung = propertyMaintenance.reduce(
      (sum, m) => sum + m.cost,
      0,
    );

    const totalCosts = jaehrlicheKreditrate + nichtUmlagefaehig + instandhaltung;
    const cashflowValue = Math.max(0, annualRent - totalCosts);

    return {
      labels: [
        'Kreditrate',
        'Nicht-umlagefähige Kosten',
        'Instandhaltung',
        'Cashflow',
      ],
      data: [
        jaehrlicheKreditrate,
        nichtUmlagefaehig,
        instandhaltung,
        cashflowValue,
      ],
    };
  }, [propertyId]);

  if (!donutData) {
    return null;
  }

  const hasData = donutData.data.some((v) => v > 0);

  if (!hasData) {
    return (
      <Card title="Kostenverteilung">
        <p className="text-sm text-stone-500 dark:text-stone-400 text-center py-8">
          Noch keine Daten zur Kostenverteilung vorhanden.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Kostenverteilung">
      <DonutChart
        labels={donutData.labels}
        data={donutData.data}
        colors={['#78716c', '#d97706', '#e11d48', '#16a34a']}
        height={280}
      />
    </Card>
  );
}
