import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';

export function RenditePage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-stone-800 mb-4">Rendite</h1>
      <Card>
        <EmptyState
          icon="📈"
          title="Renditeberechnung"
          description="Berechnen Sie Brutto- und Nettomietrendite, Cashflow und Eigenkapitalrendite Ihres Objekts."
        />
      </Card>
    </div>
  );
}
