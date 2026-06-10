import { useMemo, useState } from "react";
import { db, deleteWithTombstone, useLiveQuery } from "../../lib/db";
import { isMaintenanceForProperty } from "../../lib/db/queries";
import type { MaintenanceItem, Unit } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { ConfirmDialog } from "../../lib/ui/shared/ConfirmDialog";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { Wrench } from "../../lib/ui/ui/icons";
import { formatDate, formatEuro } from "../../lib/utils/format";

type Category = MaintenanceItem["category"];

const CATEGORY_LABELS: Record<Category, string> = {
  repair: "Reparatur",
  maintenance: "Wartung",
  inspection: "Prüfung",
  modernization: "Modernisierung",
};

const CATEGORY_COLORS: Record<Category, string> = {
  repair: "text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400",
  maintenance: "text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400",
  inspection: "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400",
  modernization: "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400",
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
  unitId: "",
  date: new Date().toISOString().slice(0, 10),
  category: "repair",
  title: "",
  description: "",
  contractor: "",
  cost: 0,
  recurring: false,
  recurringInterval: "",
  nextDue: "",
  notes: "",
};

export function MaintenanceList() {
  const { activeProperty } = useProperty();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<Category | "">("");

  const units = useLiveQuery(
    () =>
      activeProperty?.id
        ? db.units.where("propertyId").equals(activeProperty.id).toArray()
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

  const items = useLiveQuery(async () => {
    if (!activeProperty?.id) return [];
    const propertyId = activeProperty.id;
    const all = await db.maintenanceItems.toArray();
    return all.filter((item) => isMaintenanceForProperty(item, propertyId, unitIds));
  }, [activeProperty?.id, unitIds]);

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
        unitName:
          item.unitId === null ? "Gemeinschaft" : (unitMap.get(item.unitId)?.name ?? "Unbekannt"),
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
      unitId: i.unitId === null ? "" : String(i.unitId),
      date: i.date,
      category: i.category,
      title: i.title,
      description: i.description ?? "",
      contractor: i.contractor ?? "",
      cost: i.cost,
      recurring: i.recurring,
      recurringInterval: i.recurringInterval ? String(i.recurringInterval) : "",
      nextDue: i.nextDue ?? "",
      notes: i.notes ?? "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.date) return;

    const data: Omit<MaintenanceItem, "id"> = {
      unitId: form.unitId === "" ? null : parseInt(form.unitId, 10),
      // Gemeinschafts-Maßnahmen aufs aktive Objekt scopen; Legacy-Einträge
      // werden so beim nächsten Bearbeiten nachgestempelt.
      propertyId: form.unitId === "" ? activeProperty?.id : undefined,
      date: form.date,
      category: form.category,
      title: form.title.trim(),
      description: form.description || undefined,
      contractor: form.contractor || undefined,
      cost: form.cost,
      recurring: form.recurring,
      recurringInterval:
        form.recurring && form.recurringInterval ? parseInt(form.recurringInterval, 10) : undefined,
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
      await deleteWithTombstone("maintenanceItems", deleteId);
      setDeleteId(null);
    }
  };

  const columns: Column<MaintenanceRow>[] = [
    {
      key: "date",
      header: "Datum",
      render: (r) => formatDate(r.item.date),
      sortValue: (r) => r.item.date,
    },
    {
      key: "unit",
      header: "Wohnung",
      render: (r) => (
        <span className={r.item.unitId === null ? "text-fg-muted italic" : ""}>{r.unitName}</span>
      ),
      sortValue: (r) => r.unitName,
    },
    {
      key: "category",
      header: "Kategorie",
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
      key: "title",
      header: "Titel",
      render: (r) => <span className="font-medium">{r.item.title}</span>,
      sortValue: (r) => r.item.title,
    },
    {
      key: "cost",
      header: "Kosten",
      render: (r) => <span className="font-mono">{formatEuro(r.item.cost)}</span>,
      sortValue: (r) => r.item.cost,
      align: "right",
    },
    {
      key: "contractor",
      header: "Handwerker",
      render: (r) => r.item.contractor ?? <span className="text-fg-subtle">–</span>,
      sortValue: (r) => r.item.contractor ?? "",
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
            className="text-xs text-fg-subtle hover:text-fg"
          >
            Bearbeiten
          </button>
          <button
            type="button"
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
    "w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500";

  return (
    <>
      <Card
        title="Alle Maßnahmen"
        action={
          <div className="flex gap-2 items-center">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as Category | "")}
              className="text-sm border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
            >
              <option value="">Alle Kategorien</option>
              {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={openAdd}
              className="text-sm px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              + Neue Maßnahme
            </button>
          </div>
        }
      >
        {showForm && (
          <div className="mb-4 p-4 bg-surface-muted rounded-lg border border-border">
            <h3 className="text-sm font-semibold text-fg mb-3">
              {editItem ? "Maßnahme bearbeiten" : "Neue Maßnahme"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block">
                  <span className="block text-xs font-medium text-fg-muted mb-1">Titel *</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="z.B. Heizungswartung"
                    className={inputCls}
                  />
                </label>
              </div>
              <div>
                <label className="block">
                  <span className="block text-xs font-medium text-fg-muted mb-1">Datum *</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className={inputCls}
                  />
                </label>
              </div>
              <div>
                <label className="block">
                  <span className="block text-xs font-medium text-fg-muted mb-1">Kategorie</span>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                    className={inputCls}
                  >
                    {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <label className="block">
                  <span className="block text-xs font-medium text-fg-muted mb-1">Wohnung</span>
                  <select
                    value={form.unitId}
                    onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Gemeinschaft</option>
                    {(units ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <NumInput
                label="Kosten (EUR)"
                value={form.cost}
                onChange={(v) => setForm({ ...form, cost: v })}
                min={0}
              />
              <div>
                <label className="block">
                  <span className="block text-xs font-medium text-fg-muted mb-1">Handwerker</span>
                  <input
                    type="text"
                    value={form.contractor}
                    onChange={(e) => setForm({ ...form, contractor: e.target.value })}
                    placeholder="Firmenname"
                    className={inputCls}
                  />
                </label>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block">
                  <span className="block text-xs font-medium text-fg-muted mb-1">Beschreibung</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className={inputCls}
                  />
                </label>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-fg-muted pb-1.5">
                  <input
                    type="checkbox"
                    checked={form.recurring}
                    onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
                    className="rounded border-border"
                  />
                  Wiederkehrend
                </label>
              </div>
              {form.recurring && (
                <>
                  <div>
                    <label className="block">
                      <span className="block text-xs font-medium text-fg-muted mb-1">
                        Intervall (Monate)
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={form.recurringInterval}
                        onChange={(e) => setForm({ ...form, recurringInterval: e.target.value })}
                        placeholder="z.B. 12"
                        className={inputCls}
                      />
                    </label>
                  </div>
                  <div>
                    <label className="block">
                      <span className="block text-xs font-medium text-fg-muted mb-1">
                        Nächste Fälligkeit
                      </span>
                      <input
                        type="date"
                        value={form.nextDue}
                        onChange={(e) => setForm({ ...form, nextDue: e.target.value })}
                        className={inputCls}
                      />
                    </label>
                  </div>
                </>
              )}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block">
                  <span className="block text-xs font-medium text-fg-muted mb-1">Notizen</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    className={inputCls}
                  />
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 text-sm bg-zinc-800 text-white rounded-lg hover:bg-zinc-900 transition-colors"
              >
                Speichern
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditItem(null);
                }}
                className="px-4 py-1.5 text-sm border border-border text-fg-muted rounded-lg hover:bg-surface-muted transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={<Wrench size={24} strokeWidth={1.75} />}
            title="Keine Maßnahmen"
            description="Legen Sie Reparaturen, Wartungen und Prüfungen an."
            action={{ label: "+ Neue Maßnahme", onClick: openAdd }}
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
