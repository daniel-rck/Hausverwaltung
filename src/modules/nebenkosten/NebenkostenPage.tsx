import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';

export function NebenkostenPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-stone-800 mb-4">Nebenkostenabrechnung</h1>
      <Card>
        <EmptyState
          icon="📋"
          title="Nebenkostenabrechnung"
          description="Hier können Sie Nebenkostenabrechnungen für Ihre Mieter erstellen. Legen Sie zuerst Wohnungen und Mieter an."
        />
      </Card>
    </div>
  );
}
