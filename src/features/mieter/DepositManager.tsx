import { useMemo, useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { DepositEvent, DepositEventType, Occupancy } from "../../lib/db/schema";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { StatusBadge } from "../../lib/ui/shared/StatusBadge";
import {
  Button,
  Callout,
  FormField,
  Input,
  required,
  Select,
  Skeleton,
  useFormValidation,
  useToast,
  type ValidationSchema,
} from "../../lib/ui/ui";
import { Landmark, Plus } from "../../lib/ui/ui/icons";
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

type DepositFormValues = {
  date: string;
  type: DepositEventType;
  amount: number;
  description: string;
};

const EMPTY_FORM: DepositFormValues = { date: "", type: "payment", amount: 0, description: "" };

const depositSchema: ValidationSchema<DepositFormValues> = {
  date: required("Bitte Datum angeben"),
  amount: (value) =>
    typeof value === "number" && value > 0 ? null : "Betrag muss größer als 0 sein",
};

export function DepositManager({ occupancy }: DepositManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DepositFormValues>(EMPTY_FORM);
  const toast = useToast();
  const { errors, validate, clear } = useFormValidation<DepositFormValues>(depositSchema);

  const events = useLiveQuery(async () => {
    if (occupancy.id == null) return [];
    const rows = await db.depositEvents.where("occupancyId").equals(occupancy.id).toArray();
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [occupancy.id]);

  // Nur Einzahlungen tilgen die Soll-Kaution; Zinsen erhöhen zwar das Guthaben
  // des Mieters, zählen aber nicht als eingezahlte Kaution.
  const totals = useMemo(() => {
    const t = { paid: 0, interest: 0, deducted: 0, refunded: 0 };
    for (const e of events ?? []) {
      switch (e.type) {
        case "payment":
          t.paid += e.amount;
          break;
        case "interest":
          t.interest += e.amount;
          break;
        case "deduction":
          t.deducted += e.amount;
          break;
        case "refund":
          t.refunded += e.amount;
          break;
      }
    }
    return t;
  }, [events]);

  // Aktuell gehaltenes Kautionsguthaben (inkl. Zinsen, abzgl. Abzüge/Erstattungen).
  const balance = totals.paid + totals.interest - totals.deducted - totals.refunded;
  const remaining = occupancy.deposit - totals.paid;
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

  const closeForm = () => {
    setForm(EMPTY_FORM);
    clear();
    setShowForm(false);
  };

  const handleSave = async () => {
    if (occupancy.id == null) return;
    if (!validate(form)) return;

    try {
      await db.depositEvents.add({
        occupancyId: occupancy.id,
        date: form.date,
        type: form.type,
        amount: form.amount,
        description: form.description || undefined,
      });
      toast.success("Kautionsvorgang gespeichert.");
      closeForm();
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    }
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
          <span className={`font-mono ${isNegative ? "text-danger-fg" : "text-success-fg"}`}>
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
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setShowForm(true)}
          >
            Vorgang erfassen
          </Button>
        ) : undefined
      }
    >
      {/* Header info */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 bg-surface-sunken rounded-lg">
          <p className="text-xs text-fg-muted mb-0.5">Soll-Kaution</p>
          <p className="font-semibold font-mono text-fg">{formatEuro(occupancy.deposit)}</p>
        </div>
        <div className="p-3 bg-surface-sunken rounded-lg">
          <p className="text-xs text-fg-muted mb-0.5">Eingezahlt</p>
          <p className="font-semibold font-mono text-fg">{formatEuro(totals.paid)}</p>
        </div>
        <div className="p-3 bg-surface-sunken rounded-lg">
          <p className="text-xs text-fg-muted mb-0.5">Zinsen</p>
          <p className="font-semibold font-mono text-fg">{formatEuro(totals.interest)}</p>
          <p className="text-xs text-fg-subtle mt-0.5">
            Guthaben: <span className="font-mono">{formatEuro(balance)}</span>
          </p>
        </div>
        <div className="p-3 bg-surface-sunken rounded-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-fg-muted mb-0.5">Offen</p>
            <p className="font-semibold font-mono text-fg">
              {isPaid ? formatEuro(0) : formatEuro(remaining)}
            </p>
          </div>
          <StatusBadge status={isPaid ? "green" : "red"} label={isPaid ? "Bezahlt" : "Offen"} />
        </div>
      </div>

      {/* Move-out warning */}
      {moveoutWarning && (
        <Callout variant="warning" className="mb-4">
          {moveoutWarning}
        </Callout>
      )}

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
          <h3 className="text-sm font-semibold text-fg mb-3">Vorgang erfassen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Datum" required error={errors.date}>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </FormField>
            <FormField label="Art" required>
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as DepositEventType })}
              >
                <option value="payment">Einzahlung</option>
                <option value="interest">Verzinsung</option>
                <option value="deduction">Abzug</option>
                <option value="refund">Erstattung</option>
              </Select>
            </FormField>
            <FormField label="Betrag" required error={errors.amount}>
              <NumInput
                value={form.amount}
                onChange={(v) => setForm({ ...form, amount: v })}
                suffix="€"
                min={0}
              />
            </FormField>
            <FormField label="Beschreibung">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
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
          </div>
        </form>
      )}

      {/* Events table */}
      {events === undefined ? (
        <div className="space-y-2">
          <Skeleton height="2rem" />
          <Skeleton height="2rem" />
        </div>
      ) : events.length > 0 ? (
        <DataTable
          columns={columns}
          data={events}
          keyFn={(r) => r.id ?? `${r.date}-${r.type}-${r.amount}`}
        />
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
