import { Flame, Zap } from "lucide-react";
import { useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { SupplierBill } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { PageHeader } from "../../lib/ui/layout/PageHeader";
import { Card } from "../../lib/ui/shared/Card";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { FormField, KpiTile, Select, type TabItem, Tabs } from "../../lib/ui/ui";
import { Droplet, Thermometer } from "../../lib/ui/ui/icons";
import { formatEuro } from "../../lib/utils/format";
import { AnomalyAlerts } from "./AnomalyAlerts";
import { DifferenzAnalyse } from "./DifferenzAnalyse";
import { ProKopfChart } from "./ProKopfChart";
import { SupplierInput } from "./SupplierInput";
import { WarmKaltRatio } from "./WarmKaltRatio";

type SupplierType = "water" | "gas" | "electricity" | "heating";

const TAB_ITEMS: TabItem<SupplierType>[] = [
  { id: "water", label: "Wasser", icon: <Droplet size={14} strokeWidth={1.75} /> },
  { id: "gas", label: "Gas", icon: <Flame size={14} strokeWidth={1.75} /> },
  { id: "electricity", label: "Strom", icon: <Zap size={14} strokeWidth={1.75} /> },
  { id: "heating", label: "Fernwärme", icon: <Thermometer size={14} strokeWidth={1.75} /> },
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
            .where("[year+type]")
            .equals([year, type])
            .filter((b) => b.propertyId === propertyId)
            .toArray()
        : Promise.resolve([] as SupplierBill[]),
    [year, type, propertyId],
  );

  if (!bills || bills.length === 0) {
    return (
      <Card title="Verbrauchsübersicht">
        <p className="text-sm text-fg-muted">Keine Rechnungen für dieses Jahr erfasst.</p>
      </Card>
    );
  }

  const totalAmount = bills.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalConsumption = bills.reduce((sum, b) => sum + b.totalConsumption, 0);
  const unit = bills[0]?.unit ?? "";

  return (
    <Card title="Verbrauchsübersicht">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiTile label="Gesamtkosten" value={formatEuro(totalAmount)} accent="wasser" />
        <KpiTile
          label="Gesamtverbrauch"
          value={`${totalConsumption.toLocaleString("de-DE")} ${unit}`}
          accent="wasser"
        />
        <KpiTile label="Rechnungen" value={bills.length} />
      </div>
    </Card>
  );
}

export function WasserPage() {
  const { activeProperty } = useProperty();
  const [year, setYear] = useState(currentYear);
  const [supplierType, setSupplierType] = useState<SupplierType>("water");

  if (!activeProperty) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Versorger & Verbrauch"
          icon={<Droplet size={20} strokeWidth={1.75} />}
          accent="wasser"
        />
        <Card>
          <EmptyState
            icon={<Droplet size={24} strokeWidth={1.75} />}
            title="Kein Objekt ausgewählt"
            description="Bitte wähle zuerst ein Objekt aus, um die Verbrauchsanalyse durchzuführen."
          />
        </Card>
      </div>
    );
  }

  const yearOptions = buildYearOptions();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Versorger & Verbrauch"
        description="Wasser, Gas, Strom und Wärme — Rechnungen, Verbräuche und Auffälligkeiten."
        icon={<Droplet size={20} strokeWidth={1.75} />}
        accent="wasser"
        actions={
          <FormField label="Jahr" htmlFor="year-select">
            <Select
              id="year-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="!h-9 max-w-[120px]"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </FormField>
        }
      />

      <Tabs items={TAB_ITEMS} value={supplierType} onChange={setSupplierType} accent="wasser" />

      <div className="space-y-6">
        <SupplierInput year={year} type={supplierType} />
        {supplierType === "water" ? (
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
