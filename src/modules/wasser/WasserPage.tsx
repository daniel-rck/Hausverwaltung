import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';

export function WasserPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-stone-800 mb-4">Wasseranalyse</h1>
      <Card>
        <EmptyState
          icon="💧"
          title="Wasserverbrauch analysieren"
          description="Vergleichen Sie Versorger- und Messdienstleister-Daten, erkennen Sie Anomalien und analysieren Sie den Pro-Kopf-Verbrauch."
        />
      </Card>
    </div>
  );
}
