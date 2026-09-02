import { useMemo, useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { Occupancy, RentChange, RentChangeReason, Unit } from "../../lib/db/schema";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { TrendingUp } from "../../lib/ui/ui/icons";
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

export function RentHistory({ occupancy, unit }: RentHistoryProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    effectiveDate: "",
    newRentCold: occupancy.rentCold,
    reason: "mietspiegel" as RentChangeReason,
    notes: "",
  });

  const changes = useLiveQuery(
    () =>
      db.rentChanges
        .where("occupancyId")
        .equals(occupancy.id!)
        .toArray()
        .then((rows) => rows.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))),
    [occupancy.id],
  );

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

  const handleSave = async () => {
    if (!form.effectiveDate || form.newRentCold <= 0) return;
    if (hasErrors && !overrideErrors) return;

    await db.rentChanges.add({
      occupancyId: occupancy.id!,
      effectiveDate: form.effectiveDate,
      oldRentCold: occupancy.rentCold,
      newRentCold: form.newRentCold,
      reason: form.reason,
      notes: form.notes || undefined,
    });

    await db.occupancies.update(occupancy.id!, { rentCold: form.newRentCold });

    setForm({
      effectiveDate: "",
      newRentCold: form.newRentCold,
      reason: "mietspiegel",
      notes: "",
    });
    setOverrideErrors(false);
    setShowForm(false);
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
        const cls =
          diff > 0
            ? "text-red-600 dark:text-red-400"
            : diff < 0
              ? "text-green-600 dark:text-green-400"
              : "";
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
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Mieterhöhung erfassen
          </button>
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
        <div className="mb-4 p-4 bg-surface-muted rounded-lg border border-border">
          <h3 className="text-sm font-semibold text-fg mb-3">Mieterhöhung erfassen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block">
                <span className="block text-xs font-medium text-fg-muted mb-1">Wirksam ab *</span>
                <input
                  type="month"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </label>
            </div>
            <NumInput
              label="Neue Kaltmiete *"
              value={form.newRentCold}
              onChange={(v) => setForm({ ...form, newRentCold: v })}
              suffix="€"
              min={0}
            />
            <div>
              <label className="block">
                <span className="block text-xs font-medium text-fg-muted mb-1">Grund *</span>
                <select
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value as RentChangeReason })}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="mietspiegel">Mietspiegel</option>
                  <option value="index">Indexanpassung</option>
                  <option value="modernization">Modernisierung</option>
                  <option value="agreement">Vereinbarung</option>
                </select>
              </label>
            </div>
            <div>
              <label className="block">
                <span className="block text-xs font-medium text-fg-muted mb-1">Notiz</span>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </label>
            </div>
          </div>
          {issues.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {issues.map((issue) => (
                <div
                  key={issue.message}
                  className={`text-xs px-3 py-2 rounded-lg border ${
                    issue.level === "error"
                      ? "bg-red-50 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200"
                      : "bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200"
                  }`}
                >
                  {issue.message}
                </div>
              ))}
              {hasErrors && (
                <label className="flex items-center gap-2 text-xs text-fg-muted mt-1">
                  <input
                    type="checkbox"
                    checked={overrideErrors}
                    onChange={(e) => setOverrideErrors(e.target.checked)}
                  />
                  Trotzdem speichern (juristische Verantwortung übernehme ich)
                </label>
              )}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={hasErrors && !overrideErrors}
              className="px-4 py-1.5 text-sm bg-fg text-surface rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setOverrideErrors(false);
              }}
              className="px-4 py-1.5 text-sm border border-border text-fg-muted rounded-lg hover:bg-surface-muted transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* History table */}
      {changes && changes.length > 0 ? (
        <DataTable columns={columns} data={changes} keyFn={(r) => r.id!} />
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
