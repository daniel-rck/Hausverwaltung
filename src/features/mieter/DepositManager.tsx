import { useMemo, useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { DepositEvent, DepositEventType, Occupancy } from "../../lib/db/schema";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { StatusBadge } from "../../lib/ui/shared/StatusBadge";
import { AlertTriangle, Landmark } from "../../lib/ui/ui/icons";
import { formatDate, formatEuro } from "../../lib/utils/format";

interface DepositManagerProps {
  occupancy: Occupancy;
}

const EVENT_TYPE_LABELS: Record<DepositEventType, string> = {
  payment: "Einzahlung",
  interest: "Verzinsung",
  deduction: "Abzug",
  refund: "Erstattung",
};

export function DepositManager({ occupancy }: DepositManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: "",
    type: "payment" as DepositEventType,
    amount: 0,
    description: "",
  });

  const events = useLiveQuery(
    () =>
      db.depositEvents
        .where("occupancyId")
        .equals(occupancy.id!)
        .toArray()
        .then((rows) => rows.sort((a, b) => a.date.localeCompare(b.date))),
    [occupancy.id],
  );

  const balance = useMemo(() => {
    if (!events) return 0;
    return events.reduce((sum, e) => {
      switch (e.type) {
        case "payment":
          return sum + e.amount;
        case "interest":
          return sum + e.amount;
        case "deduction":
          return sum - e.amount;
        case "refund":
          return sum - e.amount;
        default:
          return sum;
      }
    }, 0);
  }, [events]);

  const remaining = occupancy.deposit - balance;
  const isPaid = remaining <= 0;

  // Move-out warning: > 6 months since moveout and balance > 0.
  // UTC-Arithmetik vermeidet DST-/Timezone-Verschiebungen.
  const moveoutWarning = useMemo(() => {
    if (!occupancy.to || balance <= 0) return null;

    const [y = 0, m = 1] = occupancy.to.split("-").map(Number);
    const deadline = new Date(Date.UTC(y, m - 1 + 6, 1));

    const now = new Date();
    if (now > deadline) {
      const dd = String(deadline.getUTCDate()).padStart(2, "0");
      const mm = String(deadline.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = deadline.getUTCFullYear();
      return `Kaution muss innerhalb von 6 Monaten nach Auszug (bis ${dd}.${mm}.${yyyy}) abgerechnet werden.`;
    }

    return null;
  }, [occupancy.to, balance]);

  const handleSave = async () => {
    if (!form.date || form.amount <= 0) return;

    await db.depositEvents.add({
      occupancyId: occupancy.id!,
      date: form.date,
      type: form.type,
      amount: form.amount,
      description: form.description || undefined,
    });

    setForm({ date: "", type: "payment", amount: 0, description: "" });
    setShowForm(false);
  };

  const columns: Column<DepositEvent>[] = [
    {
      key: "date",
      header: "Datum",
      render: (r) => formatDate(r.date),
      sortValue: (r) => r.date,
    },
    {
      key: "type",
      header: "Art",
      render: (r) => EVENT_TYPE_LABELS[r.type],
    },
    {
      key: "amount",
      header: "Betrag",
      render: (r) => {
        const isNegative = r.type === "deduction" || r.type === "refund";
        return (
          <span
            className={`font-mono ${isNegative ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
          >
            {isNegative ? "−" : "+"}
            {formatEuro(r.amount)}
          </span>
        );
      },
      align: "right",
      sortValue: (r) => r.amount,
    },
    {
      key: "description",
      header: "Beschreibung",
      render: (r) => (
        <span className="text-fg-muted truncate max-w-[200px] inline-block">
          {r.description ?? "–"}
        </span>
      ),
    },
  ];

  return (
    <Card
      title="Kautionsverwaltung"
      action={
        !showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Vorgang erfassen
          </button>
        ) : undefined
      }
    >
      {/* Header info */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-surface-sunken rounded-lg">
          <p className="text-xs text-fg-muted mb-0.5">Soll-Kaution</p>
          <p className="font-semibold font-mono text-fg">{formatEuro(occupancy.deposit)}</p>
        </div>
        <div className="p-3 bg-surface-sunken rounded-lg">
          <p className="text-xs text-fg-muted mb-0.5">Eingezahlt</p>
          <p className="font-semibold font-mono text-fg">{formatEuro(balance)}</p>
        </div>
        <div className="p-3 bg-surface-sunken rounded-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-fg-muted mb-0.5">Status</p>
            <p className="font-semibold font-mono text-fg">
              {isPaid ? formatEuro(0) : formatEuro(remaining)}
            </p>
          </div>
          <StatusBadge status={isPaid ? "green" : "red"} label={isPaid ? "Bezahlt" : "Offen"} />
        </div>
      </div>

      {/* Move-out warning */}
      {moveoutWarning && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60 rounded-md">
          <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle
              size={14}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <span>{moveoutWarning}</span>
          </p>
        </div>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="mb-4 p-4 bg-surface-muted rounded-lg border border-border">
          <h3 className="text-sm font-semibold text-fg mb-3">Vorgang erfassen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block">
                <span className="block text-xs font-medium text-fg-muted mb-1">Datum *</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </label>
            </div>
            <div>
              <label className="block">
                <span className="block text-xs font-medium text-fg-muted mb-1">Art *</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as DepositEventType })}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="payment">Einzahlung</option>
                  <option value="interest">Verzinsung</option>
                  <option value="deduction">Abzug</option>
                  <option value="refund">Erstattung</option>
                </select>
              </label>
            </div>
            <NumInput
              label="Betrag *"
              value={form.amount}
              onChange={(v) => setForm({ ...form, amount: v })}
              suffix="€"
              min={0}
            />
            <div>
              <label className="block">
                <span className="block text-xs font-medium text-fg-muted mb-1">Beschreibung</span>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-fg text-surface rounded-lg hover:opacity-90 transition-colors"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-sm border border-border text-fg-muted rounded-lg hover:bg-surface-muted transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Events table */}
      {events && events.length > 0 ? (
        <DataTable columns={columns} data={events} keyFn={(r) => r.id!} />
      ) : (
        <EmptyState
          icon={<Landmark size={24} strokeWidth={1.75} />}
          title="Keine Kautionsvorgänge"
          description="Erfassen Sie Einzahlungen, Verzinsungen oder Rückerstattungen."
        />
      )}
    </Card>
  );
}
