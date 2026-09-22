import { useCallback, useId, useMemo, useState } from "react";
import { db, deleteWithTombstone, useLiveQuery } from "../../lib/db";
import type { Occupancy, Payment, Tenant, Unit } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { NumInput } from "../../lib/ui/shared/NumInput";
import {
  Button,
  FormField,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
  useConfirm,
  useToast,
} from "../../lib/ui/ui";
import { Calendar } from "../../lib/ui/ui/icons";
import { todayIso } from "../../lib/utils/dates";
import { formatEuro, MONTH_NAMES } from "../../lib/utils/format";
import { buildRentLookup } from "../../lib/utils/rent";

interface PaymentForm {
  amountCold: number;
  amountUtilities: number;
  receivedDate: string;
  method: Payment["method"];
  notes: string;
}

interface CellData {
  occupancy: Occupancy;
  unit: Unit;
  tenant: Tenant;
  month: string;
  expected: number;
  expectedCold: number;
  payment: Payment | undefined;
  received: number;
  status: "green" | "yellow" | "red" | "gray";
}

interface MonthOverviewProps {
  year: number;
}

const METHOD_LABELS: Record<Payment["method"], string> = {
  transfer: "Überweisung",
  cash: "Bar",
  debit: "Lastschrift",
};

const STATUS_LABELS: Record<CellData["status"], string> = {
  green: "Vollständig bezahlt",
  yellow: "Teilweise bezahlt",
  red: "Offen",
  gray: "Kein Mietverhältnis",
};

const STATUS_CLASSES: Record<CellData["status"], string> = {
  green: "bg-success/15 text-success-fg hover:bg-success/25",
  yellow: "bg-warning/15 text-warning-fg hover:bg-warning/25",
  red: "bg-danger/15 text-danger-fg hover:bg-danger/25",
  gray: "bg-surface-muted text-fg-subtle cursor-default",
};

export function MonthOverview({ year }: MonthOverviewProps) {
  const { activeProperty } = useProperty();
  const [editingCell, setEditingCell] = useState<{
    occupancyId: number;
    month: string;
  } | null>(null);
  const [form, setForm] = useState<PaymentForm>({
    amountCold: 0,
    amountUtilities: 0,
    receivedDate: "",
    method: "transfer",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const formId = useId();

  const data = useLiveQuery(async () => {
    if (!activeProperty?.id) return null;

    const units = await db.units.where("propertyId").equals(activeProperty.id).toArray();

    const unitIds = units.flatMap((u) => (u.id != null ? [u.id] : []));
    const allOccupancies = await db.occupancies.toArray();
    const occupancies = allOccupancies.filter((o) => unitIds.includes(o.unitId));

    const tenantIds = [...new Set(occupancies.map((o) => o.tenantId))];
    const tenants = await db.tenants.bulkGet(tenantIds);
    const tenantMap = new Map<number, Tenant>();
    for (const t of tenants) {
      if (t?.id != null) tenantMap.set(t.id, t);
    }

    const unitMap = new Map<number, Unit>();
    for (const u of units) {
      if (u.id != null) unitMap.set(u.id, u);
    }

    const allPayments = await db.payments.toArray();
    const paymentMap = new Map<string, Payment>();
    for (const p of allPayments) {
      paymentMap.set(`${p.occupancyId}-${p.month}`, p);
    }

    const rentChanges = await db.rentChanges.toArray();
    return { occupancies, unitMap, tenantMap, paymentMap, rentChanges };
  }, [activeProperty?.id]);

  const grid = useMemo((): CellData[][] => {
    if (!data) return [];

    const { occupancies, unitMap, tenantMap, paymentMap, rentChanges } = data;
    const rentAt = buildRentLookup(rentChanges);
    const rows: CellData[][] = [];

    // Filter to occupancies active during this year
    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;

    const relevantOccs = occupancies.filter(
      (o) => o.from <= yearEnd && (o.to === null || o.to >= yearStart),
    );

    // Sort by unit name, then tenant name
    relevantOccs.sort((a, b) => {
      const unitA = unitMap.get(a.unitId)?.name ?? "";
      const unitB = unitMap.get(b.unitId)?.name ?? "";
      if (unitA !== unitB) return unitA.localeCompare(unitB);
      const tA = tenantMap.get(a.tenantId)?.name ?? "";
      const tB = tenantMap.get(b.tenantId)?.name ?? "";
      return tA.localeCompare(tB);
    });

    for (const occ of relevantOccs) {
      const unit = unitMap.get(occ.unitId);
      const tenant = tenantMap.get(occ.tenantId);
      if (!unit || !tenant) continue;

      const row: CellData[] = [];
      for (let m = 1; m <= 12; m++) {
        const month = `${year}-${String(m).padStart(2, "0")}`;
        const isActive = occ.from <= month && (occ.to === null || occ.to >= month);

        const expectedCold = isActive ? rentAt(occ, month) : 0;
        const expected = isActive ? expectedCold + occ.rentUtilities : 0;
        const payment = paymentMap.get(`${occ.id}-${month}`);
        const received = payment ? payment.amountCold + payment.amountUtilities : 0;

        let status: CellData["status"];
        if (!isActive) {
          status = "gray";
        } else if (received >= expected && expected > 0) {
          status = "green";
        } else if (received > 0) {
          status = "yellow";
        } else {
          status = "red";
        }

        row.push({
          occupancy: occ,
          unit,
          tenant,
          month,
          expected,
          expectedCold,
          payment,
          received,
          status,
        });
      }
      rows.push(row);
    }

    return rows;
  }, [data, year]);

  const openEditor = useCallback((cell: CellData) => {
    if (cell.status === "gray" || cell.occupancy.id == null) return;
    setEditingCell({
      occupancyId: cell.occupancy.id,
      month: cell.month,
    });
    if (cell.payment) {
      setForm({
        amountCold: cell.payment.amountCold,
        amountUtilities: cell.payment.amountUtilities,
        receivedDate: cell.payment.receivedDate ?? "",
        method: cell.payment.method,
        notes: cell.payment.notes ?? "",
      });
    } else {
      setForm({
        amountCold: cell.expectedCold,
        amountUtilities: cell.occupancy.rentUtilities,
        receivedDate: todayIso(),
        method: "transfer",
        notes: "",
      });
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingCell) return;
    setSaving(true);
    try {
      const existing = await db.payments
        .where("[occupancyId+month]")
        .equals([editingCell.occupancyId, editingCell.month])
        .first();

      const paymentData: Payment = {
        ...(existing?.id ? { id: existing.id } : {}),
        occupancyId: editingCell.occupancyId,
        month: editingCell.month,
        amountCold: form.amountCold,
        amountUtilities: form.amountUtilities,
        receivedDate: form.receivedDate || undefined,
        method: form.method,
        notes: form.notes || undefined,
      };

      if (existing?.id) {
        await db.payments.put(paymentData);
      } else {
        await db.payments.add(paymentData);
      }
      toast.success("Zahlung gespeichert.");
      setEditingCell(null);
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [editingCell, form, toast]);

  const handleDelete = useCallback(async () => {
    if (!editingCell) return;
    const ok = await confirm({
      title: "Zahlung löschen?",
      message: "Die erfasste Zahlung für diesen Monat wird unwiderruflich gelöscht.",
      confirmLabel: "Löschen",
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const existing = await db.payments
        .where("[occupancyId+month]")
        .equals([editingCell.occupancyId, editingCell.month])
        .first();
      if (existing?.id) {
        await deleteWithTombstone("payments", existing.id);
      }
      toast.success("Zahlung gelöscht.");
      setEditingCell(null);
    } catch (err) {
      toast.error("Löschen fehlgeschlagen.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [editingCell, confirm, toast]);

  const closeEditor = useCallback(() => {
    if (!saving) setEditingCell(null);
  }, [saving]);

  if (data === undefined) {
    return (
      <Card title="Monatsübersicht">
        <div className="space-y-2">
          <Skeleton height="2rem" />
          <Skeleton height="2.5rem" />
          <Skeleton height="2.5rem" />
          <Skeleton height="2.5rem" />
        </div>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  if (grid.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Calendar size={24} strokeWidth={1.75} />}
          title="Keine Mietverhältnisse"
          description={`Für ${year} sind keine aktiven Mietverhältnisse vorhanden.`}
        />
      </Card>
    );
  }

  const shortMonths = MONTH_NAMES.map((n) => n.slice(0, 3));

  // Find the cell currently being edited for context display
  const editingCellData = editingCell
    ? grid
        .flat()
        .find((c) => c.occupancy.id === editingCell.occupancyId && c.month === editingCell.month)
    : undefined;

  return (
    <>
      <Card title="Monatsübersicht">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-2 text-left font-medium text-fg-muted sticky left-0 bg-surface min-w-[120px]">
                  Einheit / Mieter
                </th>
                {shortMonths.map((m) => (
                  <th
                    key={m}
                    className="py-2 px-1 text-center font-medium text-fg-muted min-w-[56px]"
                  >
                    {m}
                  </th>
                ))}
                <th className="py-2 px-2 text-right font-medium text-fg-muted min-w-[80px]">
                  Summe
                </th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row) => {
                const first = row[0];
                if (!first) return null;
                const yearTotal = row.reduce((s, c) => s + c.received, 0);
                return (
                  <tr
                    key={`${first.unit.id}-${first.tenant.id}`}
                    className="border-b border-border"
                  >
                    <td className="py-1.5 px-2 sticky left-0 bg-surface">
                      <div className="font-medium text-fg">{first.unit.name}</div>
                      <div className="text-fg-muted truncate max-w-[110px]">
                        {first.tenant.name}
                      </div>
                    </td>
                    {row.map((cell) => {
                      const monthName =
                        MONTH_NAMES[parseInt(cell.month.slice(5), 10) - 1] ?? cell.month;
                      const ariaLabel =
                        cell.status === "gray"
                          ? `${monthName}: ${STATUS_LABELS.gray}`
                          : `${monthName}: ${STATUS_LABELS[cell.status]}, Soll ${formatEuro(cell.expected)}, Ist ${formatEuro(cell.received)}`;
                      return (
                        <td key={cell.month} className="py-1.5 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => openEditor(cell)}
                            disabled={cell.status === "gray"}
                            aria-label={ariaLabel}
                            className={`w-full rounded-md py-1.5 px-0.5 text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${STATUS_CLASSES[cell.status]}`}
                            title={
                              cell.status === "gray"
                                ? "Kein Mietverhältnis"
                                : `Soll: ${formatEuro(cell.expected)}\nIst: ${formatEuro(cell.received)}`
                            }
                          >
                            {cell.status === "gray"
                              ? "–"
                              : cell.received > 0
                                ? formatEuro(cell.received).replace(/\s?€/, "")
                                : "0"}
                          </button>
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-2 text-right font-mono font-medium text-fg">
                      {formatEuro(yearTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legende */}
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-fg-muted">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-success/15 border border-success/30" />
            {STATUS_LABELS.green}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-warning/15 border border-warning/40" />
            {STATUS_LABELS.yellow}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-danger/15 border border-danger/30" />
            {STATUS_LABELS.red}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-surface-muted border border-border" />
            {STATUS_LABELS.gray}
          </span>
        </div>
      </Card>

      {/* Payment Editor Dialog */}
      <Modal
        open={Boolean(editingCell && editingCellData)}
        onClose={closeEditor}
        title="Zahlung erfassen"
        description={
          editingCell && editingCellData ? (
            <>
              {editingCellData.unit.name} &middot; {editingCellData.tenant.name} &middot;{" "}
              {MONTH_NAMES[parseInt(editingCell.month.slice(5), 10) - 1]}{" "}
              {editingCell.month.slice(0, 4)}
            </>
          ) : undefined
        }
        footer={
          <>
            {editingCellData?.payment && (
              <Button
                variant="dangerGhost"
                onClick={() => void handleDelete()}
                disabled={saving}
                className="mr-auto"
              >
                Löschen
              </Button>
            )}
            <Button variant="secondary" onClick={closeEditor} disabled={saving}>
              Abbrechen
            </Button>
            <Button type="submit" form={formId} variant="primary" loading={saving}>
              Speichern
            </Button>
          </>
        }
      >
        {editingCellData && (
          <form
            id={formId}
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <div className="p-2 bg-surface-muted rounded-lg text-xs text-fg-muted">
              Soll-Miete: {formatEuro(editingCellData.expectedCold)} Kaltmiete +{" "}
              {formatEuro(editingCellData.occupancy.rentUtilities)} Nebenkosten ={" "}
              <strong className="text-fg">{formatEuro(editingCellData.expected)}</strong>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumInput
                label="Kaltmiete"
                value={form.amountCold}
                onChange={(v) => setForm((f) => ({ ...f, amountCold: v }))}
                suffix="€"
                min={0}
              />
              <NumInput
                label="Nebenkosten"
                value={form.amountUtilities}
                onChange={(v) => setForm((f) => ({ ...f, amountUtilities: v }))}
                suffix="€"
                min={0}
              />
            </div>

            <FormField label="Eingangsdatum">
              <Input
                type="date"
                value={form.receivedDate}
                onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))}
              />
            </FormField>

            <FormField label="Zahlungsart">
              <Select
                value={form.method}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    method: e.target.value as Payment["method"],
                  }))
                }
              >
                {(Object.entries(METHOD_LABELS) as [Payment["method"], string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </Select>
            </FormField>

            <FormField label="Bemerkung">
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
              />
            </FormField>
          </form>
        )}
      </Modal>
    </>
  );
}
