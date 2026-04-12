import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';

export function ZaehlerPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-stone-800 mb-4">Zählerstand-Erfassung</h1>
      <Card>
        <EmptyState
          icon="🔢"
          title="Zählerstände"
          description="Erfassen Sie hier Ihre Zähler und Ablesungen. Kaltwasser, Warmwasser, Strom, Gas und Heizung."
        />
      </Card>
    </div>
  );
}
