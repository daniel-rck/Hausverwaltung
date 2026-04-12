import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { EmptyState } from '../../components/shared/EmptyState';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { NumInput } from '../../components/shared/NumInput';
import { formatEuro, formatDate } from '../../utils/format';
import type { MaintenanceItem, Unit } from '../../db/schema';

type Category = MaintenanceItem['category'];

const CATEGORY_LABELS: Record<Category, string> = {
  repair: 'Reparatur',
  maintenance: 'Wartung',
  inspection: 'Prüfung',
  modernization: 'Modernisierung',
};

const CATEGORY_COLORS: Record<Category, string> = {
  repair: 'text-red-600 bg-red-50',
  maintenance: 'text-amber-600 bg-amber-50',
  inspection: 'text-blue-600 bg-blue-50',
  modernization: 'text-purple-600 bg-purple-50',
};

interface MaintenanceRow {
  item: MaintenanceItem;
  unitName: string;
}

interface FormState {
  unitId: string;
  date: string;
  category: Category;
  title: string;
  description: string;
  contractor: string;
  cost: number;
  recurring: boolean;
  recurringInterval: string;
  nextDue: string;
  notes: string;
}

const emptyForm: FormState = {
  unitId: '',
  date: new Date().toISOString().slice(0, 10),
  category: 'repair',
  title: '',
  description: '',
  contractor: '',
  cost: 0,
  recurring: false,
  recurringInterval: '',
  nextDue: '',
  notes: '',
};

export function MaintenanceList() {
  const { activeProperty } = useProperty();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<Category | ''>('');

  const units = useLiveQuery(
    () =>
      activeProperty?.id
        ? db.units.where('propertyId').equals(activeProperty.id).toArray()
        : Promise.resolve([] as Unit[]),
    [activeProperty?.id],
  );

  const unitIds = useMemo(() => (units ?? []).map((u) => u.id!), [units]);
  const unitMap = useMemo(() => {
    const map = new Map<number, Unit>();
    for (const u of units ?? []) {
      map.set(u.id!, u);
    }
    return map;
  }, [units]);

  const items = useLiveQuery(
    async () => {
      if (!activeProperty?.id) return [];
      const all = await db.maintenanceItems.toArray();
      return all.filter(
        (item) => item.unitId === null || unitIds.includes(item.unitId),
      );
    },
    [activeProperty?.id, unitIds],
  );

  const rows: MaintenanceRow[] = useMemo(() => {
    if (!items) return [];
    let filtered = items;
    if (filterCategory) {
      filtered = items.filter((i) => i.category === filterCategory);
    }
    return filtered
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((item) => ({
        item,
        unitName: item.unitId === null ? 'Gemeinschaft' : (unitMap.get(item.unitId)?.name ?? 'Unbekannt'),
      }));
  }, [items, unitMap, filterCategory]);

  const openAdd = () => {
    setEditItem(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (row: MaintenanceRow) => {
    const i = row.item;
    setEditItem(i);
    setForm({
      unitId: i.unitId === null ? '' : String(i.unitId),
      date: i.date,
      category: i.category,
      title: i.title,
      description: i.description ?? '',
      contractor: i.contractor ?? '',
      cost: i.cost,
      recurring: i.recurring,
      recurringInterval: i.recurringInterval ? String(i.recurringInterval) : '',
      nextDue: i.nextDue ?? '',
      notes: i.notes ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.date) return;

    const data: Omit<MaintenanceItem, 'id'> = {
      unitId: form.unitId === '' ? null : parseInt(form.unitId),
      date: form.date,
      category: form.category,
      title: form.title.trim(),
      description: form.description || undefined,
      contractor: form.contractor || undefined,
      cost: form.cost,
      recurring: form.recurring,
      recurringInterval: form.recurring && form.recurringInterval
        ? parseInt(form.recurringInterval)
        : undefined,
      nextDue: form.nextDue || undefined,
      notes: form.notes || undefined,
    };

    if (editItem?.id) {
      await db.maintenanceItems.put({ ...data, id: editItem.id });
    } else {
      await db.maintenanceItems.add(data as MaintenanceItem);
    }

    setShowForm(false);
    setEditItem(null);
    setForm(emptyForm);
  };

  const handleDelete = async () => {
    if (deleteId !== null) {
      await db.maintenanceItems.delete(deleteId);
      setDeleteId(null);
    }
  };

  const columns: Column<MaintenanceRow>[] = [
    {
      key: 'date',
      header: 'Datum',
      render: (r) => formatDate(r.item.date),
      sortValue: (r) => r.item.date,
    },
    {
      key: 'unit',
      header: 'Wohnung',
      render: (r) => (
        <span className={r.item.unitId === null ? 'text-stone-500 italic' : ''}>
          {r.unitName}
        </span>
      ),
      sortValue: (r) => r.unitName,
    },
    {
      key: 'category',
      header: 'Kategorie',
      render: (r) => (
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[r.item.category]}`}
        >
          {CATEGORY_LABELS[r.item.category]}
        </span>
      ),
      sortValue: (r) => CATEGORY_LABELS[r.item.category],
    },
    {
      key: 'title',
      header: 'Titel',
      render: (r) => <span className="font-medium">{r.item.title}</span>,
      sortValue: (r) => r.item.title,
    },
    {
      key: 'cost',
      header: 'Kosten',
      render: (r) => <span className="font-mono">{formatEuro(r.item.cost)}</span>,
      sortValue: (r) => r.item.cost,
      align: 'right',
    },
    {
      key: 'contractor',
      header: 'Handwerker',
      render: (r) => r.item.contractor ?? <span className="text-stone-400">–</span>,
      sortValue: (r) => r.item.contractor ?? '',
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
            className="text-xs text-stone-400 hover:text-stone-700"
          >
            Bearbeiten
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(r.item.id!);
            }}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Löschen
          </button>
        </div>
      ),
    },
  ];

  const inputCls =
    'w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400';

  return (
    <>
      <Card
        title="Alle Maßnahmen"
        action={
          <div className="flex gap-2 items-center">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as Category | '')}
              className="text-sm border border-stone-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              <option value="">Alle Kategorien</option>
              {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              onClick={openAdd}
              className="text-sm px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              + Neue Maßnahme
            </button>
          </div>
        }
      >
        {showForm && (
          <div className="mb-4 p-4 bg-stone-50 rounded-lg border border-stone-200">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">
              {editItem ? 'Maßnahme bearbeiten' : 'Neue Maßnahme'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Titel *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="z.B. Heizungswartung"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Datum *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Kategorie</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                  className={inputCls}
                >
                  {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Wohnung</label>
                <select
                  value={form.unitId}
                  onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Gemeinschaft</option>
                  {(units ?? []).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <NumInput
                label="Kosten (EUR)"
                value={form.cost}
                onChange={(v) => setForm({ ...form, cost: v })}
                min={0}
              />
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Handwerker</label>
                <input
                  type="text"
                  value={form.contractor}
                  onChange={(e) => setForm({ ...form, contractor: e.target.value })}
                  placeholder="Firmenname"
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-stone-500 mb-1">Beschreibung</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className={inputCls}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-stone-600 pb-1.5">
                  <input
                    type="checkbox"
                    checked={form.recurring}
                    onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
                    className="rounded border-stone-300"
                  />
                  Wiederkehrend
                </label>
              </div>
              {form.recurring && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">
                      Intervall (Monate)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.recurringInterval}
                      onChange={(e) => setForm({ ...form, recurringInterval: e.target.value })}
                      placeholder="z.B. 12"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">
                      Nächste Fälligkeit
                    </label>
                    <input
                      type="date"
                      value={form.nextDue}
                      onChange={(e) => setForm({ ...form, nextDue: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </>
              )}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-stone-500 mb-1">Notizen</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className={inputCls}
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
                  setEditItem(null);
                }}
                className="px-4 py-1.5 text-sm border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon="🔧"
            title="Keine Maßnahmen"
            description="Legen Sie Reparaturen, Wartungen und Prüfungen an."
            action={{ label: '+ Neue Maßnahme', onClick: openAdd }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            keyFn={(r) => r.item.id!}
            onRowClick={openEdit}
          />
        )}
      </Card>

      <ConfirmDialog
        open={deleteId !== null}
        title="Maßnahme löschen"
        message="Möchten Sie diese Maßnahme wirklich löschen? Dies kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
