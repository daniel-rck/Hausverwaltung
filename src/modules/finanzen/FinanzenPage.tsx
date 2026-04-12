import { useState } from 'react';
import { useProperty } from '../../hooks/useProperty';
import { EmptyState } from '../../components/shared/EmptyState';
import { MonthOverview } from './MonthOverview';
import { OpenItems } from './OpenItems';
import { RevenueChart } from './RevenueChart';
import { TaxExport } from './TaxExport';

const currentYear = new Date().getFullYear();

export function FinanzenPage() {
  const { activeProperty } = useProperty();
  const [year, setYear] = useState(currentYear);

  if (!activeProperty) {
    return (
      <EmptyState
        icon="💶"
        title="Kein Objekt ausgewählt"
        description="Bitte wählen Sie zuerst ein Objekt aus."
      />
    );
  }

  const yearOptions: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 10; y--) {
    yearOptions.push(y);
  }

  return (
    <div className="space-y-6">
      {/* Header mit Jahresauswahl */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-800">Mieteinnahmen</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="px-2 py-1 text-sm border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
            aria-label="Vorheriges Jahr"
          >
            ‹
          </button>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="px-2 py-1 text-sm border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
            aria-label="Nächstes Jahr"
          >
            ›
          </button>
        </div>
      </div>

      {/* Monatsübersicht */}
      <MonthOverview year={year} />

      {/* Offene Posten */}
      <OpenItems year={year} />

      {/* Jahresübersicht / Chart */}
      <RevenueChart year={year} />

      {/* Steuer-Export */}
      <TaxExport year={year} />
    </div>
  );
}
