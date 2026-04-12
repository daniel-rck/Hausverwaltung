import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';

export function InstandhaltungPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-stone-800 mb-4">Instandhaltung</h1>
      <Card>
        <EmptyState
          icon="🔧"
          title="Reparaturen & Wartungen"
          description="Verwalten Sie Reparaturen, Wartungen und wiederkehrende Aufgaben. Behalten Sie Kosten und Fälligkeiten im Blick."
        />
      </Card>
    </div>
  );
}
