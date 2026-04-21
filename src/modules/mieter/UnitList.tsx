import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, bulkDeleteWithTombstones, deleteWithTombstone } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { EmptyState } from '../../components/shared/EmptyState';
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
    // Cascade: delete all dependent records (with tombstones for sync)
    const occupancies = await db.occupancies.where('unitId').equals(id).toArray();
    const occIds = occupancies.map((o) => o.id!);

    if (occIds.length > 0) {
      const [allPayments, allCostShares, allPrepayments, allHandovers] = await Promise.all([
        db.payments.toArray(),
        db.costShares.toArray(),
        db.prepayments.toArray(),
        db.handoverProtocols.toArray(),
      ]);

      await bulkDeleteWithTombstones(
        'payments',
        allPayments.filter((p) => occIds.includes(p.occupancyId)).map((p) => p.id!),
      );
      await bulkDeleteWithTombstones(
        'costShares',
        allCostShares.filter((s) => occIds.includes(s.occupancyId)).map((s) => s.id!),
      );
      await bulkDeleteWithTombstones(
        'prepayments',
        allPrepayments.filter((p) => occIds.includes(p.occupancyId)).map((p) => p.id!),
      );
      await bulkDeleteWithTombstones(
        'handoverProtocols',
        allHandovers.filter((h) => occIds.includes(h.occupancyId)).map((h) => h.id!),
      );
      await bulkDeleteWithTombstones('occupancies', occIds);
    }

    const meters = await db.meters.where('unitId').equals(id).toArray();
    for (const meter of meters) {
      const readings = await db.meterReadings.where('meterId').equals(meter.id!).toArray();
      await bulkDeleteWithTombstones(
        'meterReadings',
        readings.map((r) => r.id!).filter((rid) => rid !== undefined),
      );
    }
    await bulkDeleteWithTombstones(
      'meters',
      meters.map((m) => m.id!).filter((mid) => mid !== undefined),
    );
    const tenants = await db.tenants.where('unitId').equals(id).toArray();
    await bulkDeleteWithTombstones(
      'tenants',
      tenants.map((t) => t.id!).filter((tid) => tid !== undefined),
    );
    await deleteWithTombstone('units', id);
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
      render: (r) => r.tenant?.name ?? <span className="text-stone-400 dark:text-stone-500">–</span>,
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
          className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200"
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
        <div className="mb-4 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-200 dark:border-stone-700">
          <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-3">
            {editUnit ? 'Wohnung bearbeiten' : 'Neue Wohnung'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                Bezeichnung *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. EG, OG, KG"
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                Fläche (m²)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                placeholder="z.B. 65,5"
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                Stockwerk
              </label>
              <input
                type="text"
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
                placeholder="z.B. Erdgeschoss"
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors"
            >
              Speichern
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditUnit(null);
              }}
              className="px-4 py-1.5 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
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
          icon="🏠"
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
