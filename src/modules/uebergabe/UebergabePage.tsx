import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';

export function UebergabePage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-stone-800 mb-4">Übergabeprotokoll</h1>
      <Card>
        <EmptyState
          icon="🔑"
          title="Übergabeprotokolle"
          description="Erstellen Sie Ein- und Auszugsprotokolle mit Raumzustand, Zählerständen und Unterschriften."
        />
      </Card>
    </div>
  );
}
