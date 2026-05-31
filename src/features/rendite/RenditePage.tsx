import { useProperty } from "../../lib/hooks/useProperty";
import { PageHeader } from "../../lib/ui/layout/PageHeader";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { TrendingUp } from "../../lib/ui/ui/icons";
import { CashflowChart } from "./CashflowChart";
import { CostDonut } from "./CostDonut";
import { FinancingInput } from "./FinancingInput";
import { YieldCalculation } from "./YieldCalculation";

export function RenditePage() {
  const { activeProperty } = useProperty();

  if (!activeProperty) {
    return (
      <EmptyState
        icon={<TrendingUp size={24} strokeWidth={1.75} />}
        title="Kein Objekt ausgewählt"
        description="Bitte wähle ein Objekt aus, um die Renditeberechnung anzuzeigen."
      />
    );
  }

  const propertyId = activeProperty.id!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rendite"
        description="Finanzierung, Cashflow und Wirtschaftlichkeit deines Objekts."
        icon={<TrendingUp size={20} strokeWidth={1.75} />}
        accent="rendite"
      />

      <FinancingInput propertyId={propertyId} />
      <YieldCalculation propertyId={propertyId} />

      <div className="grid md:grid-cols-2 gap-4">
        <CashflowChart propertyId={propertyId} />
        <CostDonut propertyId={propertyId} />
      </div>
    </div>
  );
}
