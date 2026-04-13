import { useState } from 'react';
import { useProperty } from '../../hooks/useProperty';
import { EmptyState } from '../../components/shared/EmptyState';
import { Card } from '../../components/shared/Card';
import { SupplierInput } from './SupplierInput';
import { DifferenzAnalyse } from './DifferenzAnalyse';
import { ProKopfChart } from './ProKopfChart';
import { WarmKaltRatio } from './WarmKaltRatio';
import { AnomalyAlerts } from './AnomalyAlerts';
import { formatEuro } from '../../utils/format';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { SupplierBill } from '../../db/schema';

type SupplierType = 'water' | 'gas' | 'electricity' | 'heating';

const tabs: { key: SupplierType; label: string }[] = [
  { key: 'water', label: 'Wasser' },
  { key: 'gas', label: 'Gas' },
  { key: 'electricity', label: 'Strom' },
  { key: 'heating', label: 'Fernwärme' },
];

const currentYear = new Date().getFullYear();

function buildYearOptions(): number[] {
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y);
  }
  return years;
}

function ConsumptionSummary({ year, type }: { year: number; type: SupplierType }) {
  const { activeProperty } = useProperty();
  const propertyId = activeProperty?.id;

  const bills = useLiveQuery(
    () =>
      propertyId != null
        ? db.supplierBills
            .where('[year+type]')
            .equals([year, type])
            .filter((b) => b.propertyId === propertyId)
            .toArray()
        : Promise.resolve([] as SupplierBill[]),
    [year, type, propertyId],
  );

  if (!bills || bills.length === 0) {
    return (
      <Card title="Verbrauchsübersicht">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Keine Rechnungen für dieses Jahr erfasst.
        </p>
      </Card>
    );
  }

  const totalAmount = bills.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalConsumption = bills.reduce((sum, b) => sum + b.totalConsumption, 0);
  const unit = bills[0]?.unit ?? '';

  return (
    <Card title="Verbrauchsübersicht">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-stone-50 dark:bg-stone-700/50 rounded-lg p-4">
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">Gesamtkosten</p>
          <p className="text-lg font-semibold text-stone-800 dark:text-stone-100">
            {formatEuro(totalAmount)}
          </p>
        </div>
        <div className="bg-stone-50 dark:bg-stone-700/50 rounded-lg p-4">
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">Gesamtverbrauch</p>
          <p className="text-lg font-semibold text-stone-800 dark:text-stone-100">
            {totalConsumption.toLocaleString('de-DE')} {unit}
          </p>
        </div>
        <div className="bg-stone-50 dark:bg-stone-700/50 rounded-lg p-4">
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">Rechnungen</p>
          <p className="text-lg font-semibold text-stone-800 dark:text-stone-100">
            {bills.length}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function WasserPage() {
  const { activeProperty } = useProperty();
  const [year, setYear] = useState(currentYear);
  const [supplierType, setSupplierType] = useState<SupplierType>('water');

  if (!activeProperty) {
    return (
      <div>
        <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-4">Versorger &amp; Verbrauch</h1>
        <Card>
          <EmptyState
            icon="💧"
            title="Kein Objekt ausgewählt"
            description="Bitte wählen Sie zuerst ein Objekt aus, um die Verbrauchsanalyse durchzuführen."
          />
        </Card>
      </div>
    );
  }

  const yearOptions = buildYearOptions();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">Versorger &amp; Verbrauch</h1>
        <div className="flex items-center gap-2">
          <label
            htmlFor="year-select"
            className="text-sm font-medium text-stone-600 dark:text-stone-300"
          >
            Jahr:
          </label>
          <select
            id="year-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-stone-200 dark:border-stone-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSupplierType(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              supplierType === tab.key
                ? 'border-stone-800 dark:border-stone-200 text-stone-800 dark:text-stone-100'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        <SupplierInput year={year} type={supplierType} />
        {supplierType === 'water' ? (
          <>
            <DifferenzAnalyse year={year} />
            <ProKopfChart year={year} />
            <WarmKaltRatio year={year} />
            <AnomalyAlerts year={year} />
          </>
        ) : (
          <ConsumptionSummary year={year} type={supplierType} />
        )}
      </div>
    </div>
  );
}
