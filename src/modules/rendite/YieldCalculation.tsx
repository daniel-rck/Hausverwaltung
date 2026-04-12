import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';
import { formatEuro, formatPercent } from '../../utils/format';
import { grossYield, netYield, cashflow, equityYield } from '../../utils/calc';
import type { FinancingData } from './FinancingInput';

interface YieldCalculationProps {
  propertyId: number;
}

interface MetricCardProps {
  label: string;
  value: string;
  positive: boolean | null;
}

function MetricCard({ label, value, positive }: MetricCardProps) {
  const colorClass =
    positive === null
      ? 'text-stone-800'
      : positive
        ? 'text-green-600'
        : 'text-red-600';

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm px-4 py-3 text-center">
      <p className="text-xs font-medium text-stone-500 mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono font-tabular ${colorClass}`}>
        {value}
      </p>
    </div>
  );
}

export function YieldCalculation({ propertyId }: YieldCalculationProps) {
  const financing = useLiveQuery(async () => {
    const setting = await db.settings.get(`financing_${propertyId}`);
    return (setting?.value as FinancingData) ?? null;
  }, [propertyId]);

  const annualColdRent = useLiveQuery(async () => {
    const now = new Date().toISOString().slice(0, 10);
    const units = await db.units
      .where('propertyId')
      .equals(propertyId)
      .toArray();
    const unitIds = units.map((u) => u.id!);

    if (unitIds.length === 0) return 0;

    const allOccupancies = await db.occupancies.toArray();
    const active = allOccupancies.filter(
      (o) =>
        unitIds.includes(o.unitId) &&
        o.from <= now &&
        (o.to === null || o.to >= now),
    );

    return active.reduce((sum, o) => sum + o.rentCold * 12, 0);
  }, [propertyId]);

  if (financing === undefined || annualColdRent === undefined) {
    return null;
  }

  const kaufpreis = financing?.kaufpreis ?? 0;
  const eigenkapital = financing?.eigenkapital ?? 0;
  const jaehrlicheKreditrate = financing?.jaehrlicheKreditrate ?? 0;
  const nichtUmlagefaehig = financing?.nichtUmlagefaehigeKosten ?? 0;
  const rent = annualColdRent;

  const brutto = grossYield(rent, kaufpreis);
  const netto = netYield(rent, nichtUmlagefaehig, kaufpreis);
  const cf = cashflow(rent, jaehrlicheKreditrate, nichtUmlagefaehig);
  const cfMonat = cf / 12;
  const eqYield = equityYield(cf, eigenkapital);

  return (
    <Card title="Renditeberechnung">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Jahresnettokaltmiete"
          value={formatEuro(rent)}
          positive={rent > 0 ? true : rent < 0 ? false : null}
        />
        <MetricCard
          label="Bruttomietrendite"
          value={formatPercent(brutto)}
          positive={brutto > 0 ? true : brutto < 0 ? false : null}
        />
        <MetricCard
          label="Nettomietrendite"
          value={formatPercent(netto)}
          positive={netto > 0 ? true : netto < 0 ? false : null}
        />
        <MetricCard
          label="Monatlicher Cashflow"
          value={formatEuro(cfMonat)}
          positive={cfMonat > 0 ? true : cfMonat < 0 ? false : null}
        />
        <MetricCard
          label="Jährlicher Cashflow"
          value={formatEuro(cf)}
          positive={cf > 0 ? true : cf < 0 ? false : null}
        />
        <MetricCard
          label="Eigenkapitalrendite"
          value={formatPercent(eqYield)}
          positive={eqYield > 0 ? true : eqYield < 0 ? false : null}
        />
      </div>
    </Card>
  );
}
