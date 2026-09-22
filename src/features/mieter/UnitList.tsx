import { useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import { cascadeDeleteUnit } from "../../lib/db/cascade";
import type { Occupancy, Tenant, Unit } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { StatusBadge } from "../../lib/ui/shared/StatusBadge";
import {
  Button,
  FormField,
  Input,
  required,
  Skeleton,
  useConfirm,
  useFormValidation,
  useToast,
} from "../../lib/ui/ui";
import { Building2, Plus } from "../../lib/ui/ui/icons";
import { currentMonth } from "../../lib/utils/dates";
import { formatArea } from "../../lib/utils/format";

interface UnitRow {
  unit: Unit;
  occupancy: Occupancy | null;
  tenant: Tenant | null;
}

interface UnitListProps {
  onSelectUnit: (unit: Unit) => void;
}

type UnitFormValues = { name: string; area: number; floor: string };

const EMPTY_FORM: UnitFormValues = { name: "", area: 0, floor: "" };

const unitSchema = {
  name: required("Bitte Bezeichnung angeben"),
};

export function UnitList({ onSelectUnit }: UnitListProps) {
  const { activeProperty } = useProperty();
  const [showForm, setShowForm] = useState(false);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [form, setForm] = useState<UnitFormValues>(EMPTY_FORM);
  const toast = useToast();
  const confirm = useConfirm();
  const { errors, validate, clear } = useFormValidation<UnitFormValues>(unitSchema);

  const rows = useLiveQuery(async () => {
    if (!activeProperty?.id) return [];

    const units = await db.units.where("propertyId").equals(activeProperty.id).toArray();

    const now = currentMonth();
    const result: UnitRow[] = [];

    for (const unit of units) {
      if (unit.id == null) continue;
      const occupancies = await db.occupancies.where("unitId").equals(unit.id).toArray();

      const active = occupancies.find((o) => o.from <= now && (o.to === null || o.to >= now));

      let tenant: Tenant | null = null;
      if (active) {
        tenant = (await db.tenants.get(active.tenantId)) ?? null;
      }

      result.push({ unit, occupancy: active ?? null, tenant });
    }

    return result;
  }, [activeProperty?.id]);

  const closeForm = () => {
    setShowForm(false);
    setEditUnit(null);
    setForm(EMPTY_FORM);
    clear();
  };

  const handleSave = async () => {
    if (!activeProperty?.id) return;
    if (!validate(form)) return;

    const data = {
      propertyId: activeProperty.id,
      name: form.name.trim(),
      area: form.area,
      floor: form.floor || undefined,
    };

    try {
      if (editUnit?.id) {
        await db.units.put({ ...data, id: editUnit.id });
        toast.success("Wohnung aktualisiert.");
      } else {
        await db.units.add(data);
        toast.success("Wohnung angelegt.");
      }
      closeForm();
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    }
  };

  const handleDelete = async (unit: Unit) => {
    if (unit.id == null) return;
    const ok = await confirm({
      title: "Wohnung löschen?",
      message: `„${unit.name}“ wird mit allen Mietverhältnissen, Zahlungen, Kautionen, Mieterhöhungen, Zählern, Zählerständen, Wartungen und Dokumenten unwiderruflich gelöscht.`,
      confirmLabel: "Löschen",
      danger: true,
    });
    if (!ok) return;
    try {
      await cascadeDeleteUnit(unit.id);
      toast.success("Wohnung gelöscht.");
      closeForm();
    } catch (err) {
      toast.error("Löschen fehlgeschlagen.");
      console.error(err);
    }
  };

  const columns: Column<UnitRow>[] = [
    {
      key: "name",
      header: "Wohnung",
      render: (r) => <span className="font-medium">{r.unit.name}</span>,
      sortValue: (r) => r.unit.name,
    },
    {
      key: "area",
      header: "Fläche",
      render: (r) => <span className="font-mono font-tabular">{formatArea(r.unit.area)}</span>,
      sortValue: (r) => r.unit.area,
      align: "right",
    },
    {
      key: "tenant",
      header: "Mieter",
      render: (r) => r.tenant?.name ?? <span className="text-fg-subtle">–</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.occupancy ? (
          <StatusBadge status="green" label="Vermietet" />
        ) : (
          <StatusBadge status="yellow" label="Leerstand" />
        ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setEditUnit(r.unit);
            setForm({
              name: r.unit.name,
              area: r.unit.area,
              floor: r.unit.floor ?? "",
            });
            clear();
            setShowForm(true);
          }}
        >
          Bearbeiten
        </Button>
      ),
    },
  ];

  if (!activeProperty) return null;

  return (
    <Card
      title="Wohneinheiten"
      action={
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => {
            setEditUnit(null);
            setForm(EMPTY_FORM);
            clear();
            setShowForm(true);
          }}
        >
          Wohnung
        </Button>
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
            {editUnit ? "Wohnung bearbeiten" : "Neue Wohnung"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Bezeichnung" required error={errors.name}>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. EG, OG, KG"
              />
            </FormField>
            <FormField label="Fläche">
              <NumInput
                value={form.area}
                onChange={(area) => setForm({ ...form, area })}
                suffix="m²"
                min={0}
              />
            </FormField>
            <FormField label="Stockwerk">
              <Input
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
                placeholder="z.B. Erdgeschoss"
              />
            </FormField>
          </div>
          <div className="flex gap-2 mt-1">
            <Button type="submit" variant="primary" size="sm">
              Speichern
            </Button>
            <Button variant="outline" size="sm" onClick={closeForm}>
              Abbrechen
            </Button>
            {editUnit?.id != null && (
              <div className="ml-auto">
                <Button variant="dangerGhost" size="sm" onClick={() => void handleDelete(editUnit)}>
                  Löschen
                </Button>
              </div>
            )}
          </div>
        </form>
      )}

      {rows === undefined ? (
        <div className="space-y-2">
          <Skeleton height="2rem" />
          <Skeleton height="2rem" />
          <Skeleton height="2rem" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Building2 size={24} strokeWidth={1.75} />}
          title="Keine Wohnungen"
          description="Legen Sie die Wohneinheiten Ihres Objekts an."
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          keyFn={(r) => r.unit.id ?? r.unit.name}
          onRowClick={(r) => {
            if (!showForm) onSelectUnit(r.unit);
          }}
        />
      )}
    </Card>
  );
}
