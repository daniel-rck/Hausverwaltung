import { useState } from 'react';
import { useProperty } from '../../hooks/useProperty';
import { EmptyState } from '../../components/shared/EmptyState';
import { IconButton, Select } from '../../components/ui';
import { PageHeader } from '../../components/layout/PageHeader';
import { Wallet, ChevronLeft, ChevronRight } from '../../components/ui/icons';
import { MonthOverview } from './MonthOverview';
import { OpenItems } from './OpenItems';
import { RevenueChart } from './RevenueChart';
import { TaxExport } from './TaxExport';
import { PaymentReminder } from './PaymentReminder';

const currentYear = new Date().getFullYear();

export function FinanzenPage() {
  const { activeProperty } = useProperty();
  const [year, setYear] = useState(currentYear);

  if (!activeProperty) {
    return (
      <EmptyState
        icon={<Wallet size={24} strokeWidth={1.75} />}
        title="Kein Objekt ausgewählt"
        description="Bitte wähle zuerst ein Objekt aus."
      />
    );
  }

  const yearOptions: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 10; y--) {
    yearOptions.push(y);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mieteinnahmen"
        description="Monatsübersicht, offene Posten, Auswertungen und Steuer-Export."
        icon={<Wallet size={20} strokeWidth={1.75} />}
        accent="finanzen"
        actions={
          <div className="flex items-center gap-1">
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Vorheriges Jahr"
              onClick={() => setYear((y) => y - 1)}
              icon={<ChevronLeft size={16} strokeWidth={1.75} />}
            />
            <Select
              aria-label="Jahr"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="!h-9 max-w-[100px]"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Nächstes Jahr"
              onClick={() => setYear((y) => y + 1)}
              icon={<ChevronRight size={16} strokeWidth={1.75} />}
            />
          </div>
        }
      />

      <MonthOverview year={year} />
      <OpenItems year={year} />
      <RevenueChart year={year} />
      <PaymentReminder year={year} />
      <TaxExport year={year} />
    </div>
  );
}
