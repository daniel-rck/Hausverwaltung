import { useState } from "react";
import { useProperty } from "../../lib/hooks/useProperty";
import { PageHeader } from "../../lib/ui/layout/PageHeader";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { IconButton, Select } from "../../lib/ui/ui";
import { ChevronLeft, ChevronRight, Wallet } from "../../lib/ui/ui/icons";
import { buildYearOptions } from "../../lib/utils/years";
import { MonthOverview } from "./MonthOverview";
import { OpenItems } from "./OpenItems";
import { PaymentReminder } from "./PaymentReminder";
import { RevenueChart } from "./RevenueChart";
import { TaxExport } from "./TaxExport";

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

  const yearOptions = buildYearOptions({ currentYear, yearsForward: 1 });

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
