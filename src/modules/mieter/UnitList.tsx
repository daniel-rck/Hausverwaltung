import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { cascadeDeleteUnit } from '../../db/cascade';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { EmptyState } from '../../components/shared/EmptyState';
import { Building2 } from '../../components/ui/icons';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatArea } from '../../utils/format';
import type { Unit, Occupancy, Tenant } from '../../db/schema';

interface UnitRow {
  unit: Unit;
  occupancy: Occupancy | null;
  tenant: Tenant | null;
}

interface UnitListProps {
  onSelectUnit: (unit: Unit) => void;
}

export function UnitList({ onSelectUnit }: UnitListProps) {
  const { activeProperty } = useProperty();
  const [showForm, setShowForm] = useState(false);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [form, setForm] = useState({ name: '', area: '', floor: '' });

  const rows = useLiveQuery(async () => {
    if (!activeProperty?.id) return [];

    const units = await db.units
      .where('propertyId')
      .equals(activeProperty.id)
      .toArray();

    const now = new Date().toISOString().slice(0, 7);
    const result: UnitRow[] = [];

    for (const unit of units) {
      const occupancies = await db.occupancies
        .where('unitId')
        .equals(unit.id!)
        .toArray();

      const active = occupancies.find(
        (o) => o.from <= now && (o.to === null || o.to >= now),
      );

      let tenant: Tenant | null = null;
      if (active) {
        tenant = (await db.tenants.get(active.tenantId)) ?? null;
      }

      result.push({ unit, occupancy: active ?? null, tenant });
    }

    return result;
  }, [activeProperty?.id]);

  const handleSave = async () => {
    if (!activeProperty?.id || !form.name.trim()) return;

    const data = {
      propertyId: activeProperty.id,
      name: form.name.trim(),
      area: parseFloat(form.area.replace(',', '.')) || 0,
      floor: form.floor || undefined,
    };

    if (editUnit?.id) {
      await db.units.put({ ...data, id: editUnit.id });
    } else {
      await db.units.add(data);
    }

    setShowForm(false);
    setEditUnit(null);
    setForm({ name: '', area: '', floor: '' });
  };

  const handleDelete = async (id: number) => {
    await cascadeDeleteUnit(id);
  };

  const columns: Column<UnitRow>[] = [
    {
      key: 'name',
      header: 'Wohnung',
      render: (r) => <span className="font-medium">{r.unit.name}</span>,
      sortValue: (r) => r.unit.name,
    },
    {
      key: 'area',
      header: 'Fläche',
      render: (r) => <span className="font-mono font-tabular">{formatArea(r.unit.area)}</span>,
      sortValue: (r) => r.unit.area,
      align: 'right',
    },
    {
      key: 'tenant',
      header: 'Mieter',
      render: (r) => r.tenant?.name ?? <span className="text-zinc-400 dark:text-zinc-500">–</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) =>
        r.occupancy ? (
          <StatusBadge status="green" label="Vermietet" />
        ) : (
          <StatusBadge status="yellow" label="Leerstand" />
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditUnit(r.unit);
            setForm({
              name: r.unit.name,
              area: String(r.unit.area),
              floor: r.unit.floor ?? '',
            });
            setShowForm(true);
          }}
          className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          Bearbeiten
        </button>
      ),
    },
  ];

  if (!activeProperty) return null;

  return (
    <Card
      title="Wohneinheiten"
      action={
        <button
          onClick={() => {
            setEditUnit(null);
            setForm({ name: '', area: '', floor: '' });
            setShowForm(true);
          }}
          className="text-sm px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          + Wohnung
        </button>
      }
    >
      {showForm && (
        <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-3">
            {editUnit ? 'Wohnung bearbeiten' : 'Neue Wohnung'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Bezeichnung *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. EG, OG, KG"
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Fläche (m²)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                placeholder="z.B. 65,5"
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Stockwerk
              </label>
              <input
                type="text"
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
                placeholder="z.B. Erdgeschoss"
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-zinc-800 text-white rounded-lg hover:bg-zinc-900 transition-colors"
            >
              Speichern
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditUnit(null);
              }}
              className="px-4 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Abbrechen
            </button>
            {editUnit?.id && (
              <button
                onClick={() => {
                  handleDelete(editUnit.id!);
                  setShowForm(false);
                  setEditUnit(null);
                }}
                className="px-4 py-1.5 text-sm text-red-600 hover:text-red-700 ml-auto"
              >
                Löschen
              </button>
            )}
          </div>
        </div>
      )}

      {!rows || rows.length === 0 ? (
        <EmptyState
          icon={<Building2 size={24} strokeWidth={1.75} />}
          title="Keine Wohnungen"
          description="Legen Sie die Wohneinheiten Ihres Objekts an."
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          keyFn={(r) => r.unit.id!}
          onRowClick={(r) => {
            if (!showForm) onSelectUnit(r.unit);
          }}
        />
      )}
    </Card>
  );
}
