import { useMemo, useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { Occupancy, RentChange, RentChangeReason, Unit } from "../../lib/db/schema";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { NumInput } from "../../lib/ui/shared/NumInput";
import {
  Button,
  Callout,
  Checkbox,
  FormField,
  Input,
  required,
  Select,
  Skeleton,
  useFormValidation,
  useToast,
  type ValidationSchema,
} from "../../lib/ui/ui";
import { Plus, TrendingUp } from "../../lib/ui/ui/icons";
import { currentMonth } from "../../lib/utils/dates";
import { formatEuro, formatMonth } from "../../lib/utils/format";
import { checkRentIncrease } from "../../lib/utils/rentLaw";

interface RentHistoryProps {
  occupancy: Occupancy;
  unit: Unit;
}

const REASON_LABELS: Record<RentChangeReason, string> = {
  mietspiegel: "Mietspiegel",
  index: "Indexanpassung",
  modernization: "Modernisierung",
  agreement: "Vereinbarung",
};

type RentFormValues = {
  effectiveDate: string;
  newRentCold: number;
  reason: RentChangeReason;
  notes: string;
};

const rentSchema: ValidationSchema<RentFormValues> = {
  effectiveDate: required("Bitte Monat angeben"),
  newRentCold: (value) =>
    typeof value === "number" && value > 0 ? null : "Kaltmiete muss größer als 0 sein",
};

export function RentHistory({ occupancy, unit }: RentHistoryProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RentFormValues>({
    effectiveDate: "",
    newRentCold: occupancy.rentCold,
    reason: "mietspiegel",
    notes: "",
  });
  const toast = useToast();
  const { errors, validate, clear } = useFormValidation<RentFormValues>(rentSchema);

  const changes = useLiveQuery(async () => {
    if (occupancy.id == null) return [];
    const rows = await db.rentChanges.where("occupancyId").equals(occupancy.id).toArray();
    return rows.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  }, [occupancy.id]);

  const issues = useMemo(() => {
    if (!form.effectiveDate || form.newRentCold <= 0) return [];
    return checkRentIncrease({
      effectiveDate: form.effectiveDate,
      newRentCold: form.newRentCold,
      oldRentCold: occupancy.rentCold,
      reason: form.reason,
      occupancyFrom: occupancy.from,
      history: changes ?? [],
    });
  }, [form, occupancy, changes]);

  const hasErrors = issues.some((i) => i.level === "error");
  const [overrideErrors, setOverrideErrors] = useState(false);

  const closeForm = () => {
    setShowForm(false);
    setOverrideErrors(false);
    clear();
  };

  const handleSave = async () => {
    const occId = occupancy.id;
    if (occId == null) return;
    if (!validate(form)) return;
    if (hasErrors && !overrideErrors) {
      toast.error("Bitte rechtliche Hinweise prüfen oder bewusst übersteuern.");
      return;
    }

    try {
      await db.rentChanges.add({
        occupancyId: occId,
        effectiveDate: form.effectiveDate,
        oldRentCold: occupancy.rentCold,
        newRentCold: form.newRentCold,
        reason: form.reason,
        notes: form.notes || undefined,
      });

      // Zukünftige Erhöhungen erst mit Wirksamkeit übernehmen — bis dahin gilt die
      // bisherige Miete (Monats-Soll kommt ohnehin aus rentColdAt/rentChanges).
      if (form.effectiveDate.slice(0, 7) <= currentMonth()) {
        await db.occupancies.update(occId, { rentCold: form.newRentCold });
      }
      toast.success("Mieterhöhung gespeichert.");
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
      return;
    }

    setForm({
      effectiveDate: "",
      newRentCold: form.newRentCold,
      reason: "mietspiegel",
      notes: "",
    });
    closeForm();
  };

  const columns: Column<RentChange>[] = [
    {
      key: "effectiveDate",
      header: "Datum",
      render: (r) => formatMonth(r.effectiveDate),
      sortValue: (r) => r.effectiveDate,
    },
    {
      key: "oldRentCold",
      header: "Alte Miete",
      render: (r) => <span className="font-mono">{formatEuro(r.oldRentCold)}</span>,
      align: "right",
      sortValue: (r) => r.oldRentCold,
    },
    {
      key: "newRentCold",
      header: "Neue Miete",
      render: (r) => <span className="font-mono">{formatEuro(r.newRentCold)}</span>,
      align: "right",
      sortValue: (r) => r.newRentCold,
    },
    {
      key: "diff",
      header: "Differenz",
      render: (r) => {
        const diff = r.newRentCold - r.oldRentCold;
        const cls = diff > 0 ? "text-danger-fg" : diff < 0 ? "text-success-fg" : "";
        return (
          <span className={`font-mono ${cls}`}>
            {diff > 0 ? "+" : ""}
            {formatEuro(diff)}
          </span>
        );
      },
      align: "right",
    },
    {
      key: "reason",
      header: "Grund",
      render: (r) => REASON_LABELS[r.reason],
    },
    {
      key: "notes",
      header: "Notiz",
      render: (r) => (
        <span className="text-fg-muted truncate max-w-[200px] inline-block">{r.notes ?? "–"}</span>
      ),
    },
  ];

  return (
    <Card
      title={`Miethistorie – ${unit.name}`}
      action={
        !showForm ? (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setShowForm(true)}
          >
            Mieterhöhung erfassen
          </Button>
        ) : undefined
      }
    >
      {/* Current rent display */}
      <div className="mb-4 p-3 bg-surface-sunken rounded-lg">
        <p className="text-sm text-fg-muted">
          Aktuelle Kaltmiete:{" "}
          <span className="font-semibold font-mono text-fg">{formatEuro(occupancy.rentCold)}</span>
        </p>
      </div>

      {/* Inline form */}
      {showForm && (
        <form
          className="mb-4 p-4 bg-surface-muted rounded-lg border border-border"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          noValidate
        >
          <h3 className="text-sm font-semibold text-fg mb-3">Mieterhöhung erfassen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Wirksam ab" required error={errors.effectiveDate}>
              <Input
                type="month"
                value={form.effectiveDate}
                onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
              />
            </FormField>
            <FormField label="Neue Kaltmiete" required error={errors.newRentCold}>
              <NumInput
                value={form.newRentCold}
                onChange={(v) => setForm({ ...form, newRentCold: v })}
                suffix="€"
                min={0}
              />
            </FormField>
            <FormField label="Grund" required>
              <Select
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value as RentChangeReason })}
              >
                <option value="mietspiegel">Mietspiegel</option>
                <option value="index">Indexanpassung</option>
                <option value="modernization">Modernisierung</option>
                <option value="agreement">Vereinbarung</option>
              </Select>
            </FormField>
            <FormField label="Notiz">
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </FormField>
          </div>
          {issues.length > 0 && (
            <div className="mt-1 space-y-1.5">
              {issues.map((issue) => (
                <Callout
                  key={issue.message}
                  variant={issue.level === "error" ? "danger" : "warning"}
                >
                  {issue.message}
                </Callout>
              ))}
              {hasErrors && (
                <div className="pt-1">
                  <Checkbox
                    label="Trotzdem speichern (juristische Verantwortung übernehme ich)"
                    checked={overrideErrors}
                    onChange={(e) => setOverrideErrors(e.target.checked)}
                  />
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={hasErrors && !overrideErrors}
            >
              Speichern
            </Button>
            <Button variant="outline" size="sm" onClick={closeForm}>
              Abbrechen
            </Button>
          </div>
        </form>
      )}

      {/* History table */}
      {changes === undefined ? (
        <div className="space-y-2">
          <Skeleton height="2rem" />
          <Skeleton height="2rem" />
        </div>
      ) : changes.length > 0 ? (
        <DataTable
          columns={columns}
          data={changes}
          keyFn={(r) => r.id ?? `${r.effectiveDate}-${r.newRentCold}`}
        />
      ) : (
        <EmptyState
          icon={<TrendingUp size={24} strokeWidth={1.75} />}
          title="Keine Mietänderungen"
          description="Erfassen Sie Mieterhöhungen, um die Miethistorie nachzuverfolgen."
        />
      )}
    </Card>
  );
}
