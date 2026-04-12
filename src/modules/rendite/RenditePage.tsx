import { useProperty } from '../../hooks/useProperty';
import { EmptyState } from '../../components/shared/EmptyState';
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
        description="Bitte wählen Sie ein Objekt aus, um die Renditeberechnung anzuzeigen."
      />
    );
  }

  const propertyId = activeProperty.id!;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-stone-800">Rendite</h1>

      <FinancingInput propertyId={propertyId} />

      <YieldCalculation propertyId={propertyId} />

      <div className="grid md:grid-cols-2 gap-4">
        <CashflowChart propertyId={propertyId} />
        <CostDonut propertyId={propertyId} />
      </div>
    </div>
  );
}
