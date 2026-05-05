import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { EmptyState } from '../../components/shared/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import { UnitList } from './UnitList';
import { TenantForm } from './TenantForm';
import { RentBenchmark } from './RentBenchmark';
import type { Unit } from '../../db/schema';

function MieterOverview({ propertyId, onSelectUnit }: { propertyId: number; onSelectUnit: (u: Unit) => void }) {
  const units = useLiveQuery(
    () => db.units.where('propertyId').equals(propertyId).toArray(),
    [propertyId],
  );
  const occupancies = useLiveQuery(async () => {
    if (!units) return [];
    const unitIds = units.map((u) => u.id!);
    const all = await db.occupancies.toArray();
    return all.filter((o) => unitIds.includes(o.unitId));
  }, [units]);

  return (
    <div className="space-y-6">
      <UnitList onSelectUnit={onSelectUnit} />
      {units && units.length > 0 && occupancies && (
        <RentBenchmark
          propertyId={propertyId}
          units={units}
          occupancies={occupancies}
        />
      )}
    </div>
  );
}

export function MieterPage() {
  const { activeProperty, addProperty } = useProperty();
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  if (!activeProperty) {
    return (
      <EmptyState
        icon="🏠"
        title="Kein Objekt vorhanden"
        description="Lege zuerst ein Mietobjekt an."
        action={{
          label: 'Objekt anlegen',
          onClick: () => addProperty({ name: 'Mein Haus', address: '', units: 0 }),
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mieterverwaltung"
        description={selectedUnit ? `Wohnung: ${selectedUnit.name}` : 'Wohnungen, Mieter und Mietverhältnisse pflegen.'}
        icon="👤"
        accent="mieter"
        breadcrumbs={
          selectedUnit
            ? [
                { label: 'Mieter', to: '/mieter' },
                { label: selectedUnit.name },
              ]
            : undefined
        }
      />

      {selectedUnit ? (
        <TenantForm unit={selectedUnit} onBack={() => setSelectedUnit(null)} />
      ) : (
        <MieterOverview propertyId={activeProperty.id!} onSelectUnit={setSelectedUnit} />
      )}
    </div>
  );
}
