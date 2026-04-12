import { useState } from 'react';
import { useProperty } from '../../hooks/useProperty';
import { EmptyState } from '../../components/shared/EmptyState';
import { UnitList } from './UnitList';
import { TenantForm } from './TenantForm';
import type { Unit } from '../../db/schema';

export function MieterPage() {
  const { activeProperty, addProperty } = useProperty();
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  if (!activeProperty) {
    return (
      <EmptyState
        icon="🏠"
        title="Kein Objekt vorhanden"
        description="Legen Sie zuerst ein Mietobjekt an."
        action={{
          label: 'Objekt anlegen',
          onClick: () => addProperty({ name: 'Mein Haus', address: '', units: 0 }),
        }}
      />
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-4">Mieterverwaltung</h1>

      {selectedUnit ? (
        <TenantForm
          unit={selectedUnit}
          onBack={() => setSelectedUnit(null)}
        />
      ) : (
        <UnitList onSelectUnit={setSelectedUnit} />
      )}
    </div>
  );
}
