import { useState } from 'react';
import { useProperty } from '../../hooks/useProperty';
import { EmptyState } from '../../components/shared/EmptyState';
import { Card } from '../../components/shared/Card';
import { SupplierInput } from './SupplierInput';
import { DifferenzAnalyse } from './DifferenzAnalyse';
import { ProKopfChart } from './ProKopfChart';
import { WarmKaltRatio } from './WarmKaltRatio';
import { AnomalyAlerts } from './AnomalyAlerts';

const currentYear = new Date().getFullYear();

function buildYearOptions(): number[] {
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y);
  }
  return years;
}

export function WasserPage() {
  const { activeProperty } = useProperty();
  const [year, setYear] = useState(currentYear);

  if (!activeProperty) {
    return (
      <div>
        <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-4">Wasseranalyse</h1>
        <Card>
          <EmptyState
            icon="💧"
            title="Kein Objekt ausgewählt"
            description="Bitte wählen Sie zuerst ein Objekt aus, um die Wasseranalyse durchzuführen."
          />
        </Card>
      </div>
    );
  }

  const yearOptions = buildYearOptions();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">Wasseranalyse</h1>
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

      <div className="space-y-6">
        <SupplierInput year={year} />
        <DifferenzAnalyse year={year} />
        <ProKopfChart year={year} />
        <WarmKaltRatio year={year} />
        <AnomalyAlerts year={year} />
      </div>
    </div>
  );
}
