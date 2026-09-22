import { useMemo, useState } from "react";
import { bulkDeleteWithTombstones, db, deleteWithTombstone, useLiveQuery } from "../../lib/db";
import { isMaintenanceForProperty } from "../../lib/db/queries";
import type { MaintenanceItem, Unit } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { NumInput } from "../../lib/ui/shared/NumInput";
import {
  Badge,
  Button,
  Checkbox,
  FormField,
  Input,
  Select,
  Skeleton,
  Textarea,
  useConfirm,
  useFormValidation,
  useToast,
  type ValidationSchema,
} from "../../lib/ui/ui";
import { Plus, Wrench } from "../../lib/ui/ui/icons";
import { todayIso } from "../../lib/utils/dates";
import { formatDate, formatEuro } from "../../lib/utils/format";

type Category = MaintenanceItem["category"];

const CATEGORY_LABELS: Record<Category, string> = {
  repair: "Reparatur",
  maintenance: "Wartung",
  inspection: "Prüfung",
  modernization: "Modernisierung",
};

const CATEGORY_BADGE: Record<Category, "danger" | "warning" | "info" | "success"> = {
  repair: "danger",
  maintenance: "warning",
  inspection: "info",
  modernization: "success",
};

type MaintenanceRow = {
  item: MaintenanceItem;
  unitName: string;
};

type FormState = {
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
};

const validationSchema: ValidationSchema<FormState> = {
  title: (v) => (typeof v === "string" && v.trim() !== "" ? null : "Bitte Titel angeben"),
  date: (v) => (v ? null : "Bitte Datum angeben"),
  cost: (v) => (typeof v === "number" && v >= 0 ? null : "Kosten dürfen nicht negativ sein"),
  recurringInterval: (v, values) => {
    if (!values.recurring || v === "") return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 ? null : "Bitte ganze Zahl ≥ 1 angeben";
  },
};

const emptyForm: FormState = {
  unitId: "",
  date: todayIso(),
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
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const { errors, validate, clear } = useFormValidation<FormState>(validationSchema);
  const [filterCategory, setFilterCategory] = useState<Category | "">("");

  const units = useLiveQuery(
    () =>
      activeProperty?.id
        ? db.units.where("propertyId").equals(activeProperty.id).toArray()
        : Promise.resolve([] as Unit[]),
    [activeProperty?.id],
  );

  const unitIds = useMemo(
    () => (units ?? []).flatMap((u) => (u.id === undefined ? [] : [u.id])),
    [units],
  );
  const unitMap = useMemo(() => {
    const map = new Map<number, Unit>();
    for (const u of units ?? []) {
      if (u.id !== undefined) map.set(u.id, u);
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
    setForm({ ...emptyForm, date: todayIso() });
    clear();
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditItem(null);
    clear();
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
    clear();
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!validate(form)) return;

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

    setSaving(true);
    try {
      if (editItem?.id) {
        await db.maintenanceItems.put({ ...data, id: editItem.id });
        toast.success("Maßnahme aktualisiert.");
      } else {
        await db.maintenanceItems.add(data as MaintenanceItem);
        toast.success("Maßnahme angelegt.");
      }
      setShowForm(false);
      setEditItem(null);
      setForm(emptyForm);
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: MaintenanceItem) => {
    const id = item.id;
    if (id === undefined) return;
    const ok = await confirm({
      title: "Maßnahme löschen?",
      message: `„${item.title}“ und alle zugehörigen Dokumente werden gelöscht. Dies kann nicht rückgängig gemacht werden.`,
      confirmLabel: "Löschen",
      danger: true,
    });
    if (!ok) return;
    try {
      // Angehängte Dokumente mitlöschen (inkl. Tombstones für den Sync).
      const docs = await db.documents
        .where("[entityType+entityId]")
        .equals(["maintenance", id])
        .toArray();
      await bulkDeleteWithTombstones(
        "documents",
        docs.flatMap((d) => (d.id === undefined ? [] : [d.id])),
      );
      await deleteWithTombstone("maintenanceItems", id);
      if (editItem?.id === id) closeForm();
      toast.success("Maßnahme gelöscht.");
    } catch (err) {
      toast.error("Löschen fehlgeschlagen.");
      console.error(err);
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
        <Badge variant={CATEGORY_BADGE[r.item.category]}>{CATEGORY_LABELS[r.item.category]}</Badge>
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
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
          >
            Bearbeiten
          </Button>
          <Button
            variant="dangerGhost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              void handleDelete(r.item);
            }}
          >
            Löschen
          </Button>
        </div>
      ),
    },
  ];

  const categoryOptions = Object.entries(CATEGORY_LABELS) as [Category, string][];

  return (
    <Card
      title="Alle Maßnahmen"
      action={
        <div className="flex gap-2 items-center">
          <Select
            aria-label="Nach Kategorie filtern"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as Category | "")}
            className="w-auto"
          >
            <option value="">Alle Kategorien</option>
            {categoryOptions.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={openAdd}>
            Neue Maßnahme
          </Button>
        </div>
      }
    >
      {showForm && (
        <form
          className="mb-4 p-4 bg-surface-muted rounded-lg border border-border"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          noValidate
        >
          <h3 className="text-sm font-semibold text-fg mb-3">
            {editItem ? "Maßnahme bearbeiten" : "Neue Maßnahme"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1">
            <FormField label="Titel" required error={errors.title}>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="z. B. Heizungswartung"
              />
            </FormField>
            <FormField label="Datum" required error={errors.date}>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </FormField>
            <FormField label="Kategorie">
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
              >
                {categoryOptions.map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Wohnung">
              <Select
                value={form.unitId}
                onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              >
                <option value="">Gemeinschaft</option>
                {(units ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Kosten" error={errors.cost}>
              <NumInput
                value={form.cost}
                onChange={(v) => setForm({ ...form, cost: v })}
                min={0}
                suffix="€"
              />
            </FormField>
            <FormField label="Handwerker">
              <Input
                value={form.contractor}
                onChange={(e) => setForm({ ...form, contractor: e.target.value })}
                placeholder="Firmenname"
              />
            </FormField>
            <div className="sm:col-span-2 lg:col-span-3">
              <FormField label="Beschreibung">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </FormField>
            </div>
            <div className="flex items-center pb-4">
              <Checkbox
                label="Wiederkehrend"
                checked={form.recurring}
                onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
              />
            </div>
            {form.recurring && (
              <>
                <FormField label="Intervall (Monate)" error={errors.recurringInterval}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={form.recurringInterval}
                    onChange={(e) => setForm({ ...form, recurringInterval: e.target.value })}
                    placeholder="z. B. 12"
                  />
                </FormField>
                <FormField label="Nächste Fälligkeit">
                  <Input
                    type="date"
                    value={form.nextDue}
                    onChange={(e) => setForm({ ...form, nextDue: e.target.value })}
                  />
                </FormField>
              </>
            )}
            <div className="sm:col-span-2 lg:col-span-3">
              <FormField label="Notizen">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </FormField>
            </div>
          </div>
          <div className="flex gap-2 mt-1">
            <Button type="submit" variant="primary" loading={saving}>
              Speichern
            </Button>
            <Button variant="secondary" onClick={closeForm}>
              Abbrechen
            </Button>
          </div>
        </form>
      )}

      {items === undefined ? (
        <Skeleton height="10rem" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Wrench size={24} strokeWidth={1.75} />}
          title="Keine Maßnahmen"
          description="Legen Sie Reparaturen, Wartungen und Prüfungen an."
          action={{ label: "Neue Maßnahme", onClick: openAdd }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          keyFn={(r) => r.item.id ?? r.item.title}
          onRowClick={openEdit}
        />
      )}
    </Card>
  );
}
