import { useProperty } from '../../hooks/useProperty';
import { EmptyState } from '../../components/shared/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import { FinancingInput } from './FinancingInput';
import { YieldCalculation } from './YieldCalculation';
import { CashflowChart } from './CashflowChart';
import { CostDonut } from './CostDonut';

export function RenditePage() {
  const { activeProperty } = useProperty();

  if (!activeProperty) {
    return (
      <EmptyState
        icon="📈"
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
        icon="📈"
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
