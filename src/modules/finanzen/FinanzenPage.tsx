import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';

export function FinanzenPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-stone-800 mb-4">Mieteinnahmen</h1>
      <Card>
        <EmptyState
          icon="💶"
          title="Mieteinnahmen verwalten"
          description="Verfolgen Sie Soll- und Ist-Mieten, sehen Sie offene Posten und erstellen Sie Jahresübersichten."
        />
      </Card>
    </div>
  );
}
