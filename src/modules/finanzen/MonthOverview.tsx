import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteWithTombstone } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { NumInput } from '../../components/shared/NumInput';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatEuro, MONTH_NAMES } from '../../utils/format';
import type { Payment, Occupancy, Unit, Tenant } from '../../db/schema';

interface PaymentForm {
  amountCold: number;
  amountUtilities: number;
  receivedDate: string;
  method: Payment['method'];
  notes: string;
}

interface CellData {
  occupancy: Occupancy;
  unit: Unit;
  tenant: Tenant;
  month: string;
  expected: number;
  payment: Payment | undefined;
  received: number;
  status: 'green' | 'yellow' | 'red' | 'gray';
}

interface MonthOverviewProps {
  year: number;
}

const METHOD_LABELS: Record<Payment['method'], string> = {
  transfer: 'Überweisung',
  cash: 'Bar',
  debit: 'Lastschrift',
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
    receivedDate: '',
    method: 'transfer',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const data = useLiveQuery(async () => {
    if (!activeProperty?.id) return null;

    const units = await db.units
      .where('propertyId')
      .equals(activeProperty.id)
      .toArray();

    const unitIds = units.map((u) => u.id!);
    const allOccupancies = await db.occupancies.toArray();
    const occupancies = allOccupancies.filter((o) => unitIds.includes(o.unitId));

    const tenantIds = [...new Set(occupancies.map((o) => o.tenantId))];
    const tenants = await db.tenants.bulkGet(tenantIds);
    const tenantMap = new Map(
      tenants.filter(Boolean).map((t) => [t!.id!, t!])
    );

    const unitMap = new Map(units.map((u) => [u.id!, u]));

    const allPayments = await db.payments.toArray();
    const paymentMap = new Map<string, Payment>();
    for (const p of allPayments) {
      paymentMap.set(`${p.occupancyId}-${p.month}`, p);
    }

    return { occupancies, unitMap, tenantMap, paymentMap };
  }, [activeProperty?.id]);

  const grid = useMemo((): CellData[][] => {
    if (!data) return [];

    const { occupancies, unitMap, tenantMap, paymentMap } = data;
    const rows: CellData[][] = [];

    // Filter to occupancies active during this year
    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;

    const relevantOccs = occupancies.filter(
      (o) => o.from <= yearEnd && (o.to === null || o.to >= yearStart)
    );

    // Sort by unit name, then tenant name
    relevantOccs.sort((a, b) => {
      const unitA = unitMap.get(a.unitId)?.name ?? '';
      const unitB = unitMap.get(b.unitId)?.name ?? '';
      if (unitA !== unitB) return unitA.localeCompare(unitB);
      const tA = tenantMap.get(a.tenantId)?.name ?? '';
      const tB = tenantMap.get(b.tenantId)?.name ?? '';
      return tA.localeCompare(tB);
    });

    for (const occ of relevantOccs) {
      const unit = unitMap.get(occ.unitId);
      const tenant = tenantMap.get(occ.tenantId);
      if (!unit || !tenant) continue;

      const row: CellData[] = [];
      for (let m = 1; m <= 12; m++) {
        const month = `${year}-${String(m).padStart(2, '0')}`;
        const isActive =
          occ.from <= month && (occ.to === null || occ.to >= month);

        const expected = isActive ? occ.rentCold + occ.rentUtilities : 0;
        const payment = paymentMap.get(`${occ.id}-${month}`);
        const received = payment
          ? payment.amountCold + payment.amountUtilities
          : 0;

        let status: CellData['status'];
        if (!isActive) {
          status = 'gray';
        } else if (received >= expected && expected > 0) {
          status = 'green';
        } else if (received > 0) {
          status = 'yellow';
        } else {
          status = 'red';
        }

        row.push({ occupancy: occ, unit, tenant, month, expected, payment, received, status });
      }
      rows.push(row);
    }

    return rows;
  }, [data, year]);

  const openEditor = useCallback(
    (cell: CellData) => {
      if (cell.status === 'gray') return;
      setEditingCell({
        occupancyId: cell.occupancy.id!,
        month: cell.month,
      });
      if (cell.payment) {
        setForm({
          amountCold: cell.payment.amountCold,
          amountUtilities: cell.payment.amountUtilities,
          receivedDate: cell.payment.receivedDate ?? '',
          method: cell.payment.method,
          notes: cell.payment.notes ?? '',
        });
      } else {
        setForm({
          amountCold: cell.occupancy.rentCold,
          amountUtilities: cell.occupancy.rentUtilities,
          receivedDate: new Date().toISOString().slice(0, 10),
          method: 'transfer',
          notes: '',
        });
      }
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!editingCell) return;
    setSaving(true);
    try {
      const existing = await db.payments
        .where('[occupancyId+month]')
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
      setEditingCell(null);
    } finally {
      setSaving(false);
    }
  }, [editingCell, form]);

  const handleDelete = useCallback(async () => {
    if (!editingCell) return;
    setSaving(true);
    try {
      const existing = await db.payments
        .where('[occupancyId+month]')
        .equals([editingCell.occupancyId, editingCell.month])
        .first();
      if (existing?.id) {
        await deleteWithTombstone('payments', existing.id);
      }
      setEditingCell(null);
    } finally {
      setSaving(false);
    }
  }, [editingCell]);

  if (!data) {
    return null;
  }

  if (grid.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="📅"
          title="Keine Mietverhältnisse"
          description={`Für ${year} sind keine aktiven Mietverhältnisse vorhanden.`}
        />
      </Card>
    );
  }

  const shortMonths = MONTH_NAMES.map((n) => n.slice(0, 3));

  // Find the cell currently being edited for context display
  const editingCellData =
    editingCell
      ? grid
          .flat()
          .find(
            (c) =>
              c.occupancy.id === editingCell.occupancyId &&
              c.month === editingCell.month
          )
      : undefined;

  return (
    <>
      <Card title="Monatsübersicht">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-700">
                <th className="py-2 px-2 text-left font-medium text-stone-500 dark:text-stone-400 sticky left-0 bg-white dark:bg-stone-800 min-w-[120px]">
                  Einheit / Mieter
                </th>
                {shortMonths.map((m, i) => (
                  <th
                    key={i}
                    className="py-2 px-1 text-center font-medium text-stone-500 dark:text-stone-400 min-w-[56px]"
                  >
                    {m}
                  </th>
                ))}
                <th className="py-2 px-2 text-right font-medium text-stone-500 dark:text-stone-400 min-w-[80px]">
                  Summe
                </th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, ri) => {
                const first = row[0];
                const yearTotal = row.reduce((s, c) => s + c.received, 0);
                return (
                  <tr key={ri} className="border-b border-stone-100 dark:border-stone-700">
                    <td className="py-1.5 px-2 sticky left-0 bg-white dark:bg-stone-800">
                      <div className="font-medium text-stone-700 dark:text-stone-200">
                        {first.unit.name}
                      </div>
                      <div className="text-stone-500 dark:text-stone-400 truncate max-w-[110px]">
                        {first.tenant.name}
                      </div>
                    </td>
                    {row.map((cell, ci) => (
                      <td key={ci} className="py-1.5 px-1 text-center">
                        <button
                          onClick={() => openEditor(cell)}
                          disabled={cell.status === 'gray'}
                          className={`w-full rounded-md py-1.5 px-0.5 text-xs font-mono transition-colors ${
                            cell.status === 'green'
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : cell.status === 'yellow'
                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                : cell.status === 'red'
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-stone-50 dark:bg-stone-800/50 text-stone-300 cursor-default'
                          }`}
                          title={
                            cell.status === 'gray'
                              ? 'Kein Mietverhältnis'
                              : `Soll: ${formatEuro(cell.expected)}\nIst: ${formatEuro(cell.received)}`
                          }
                        >
                          {cell.status === 'gray'
                            ? '–'
                            : cell.received > 0
                              ? formatEuro(cell.received).replace(/\s?€/, '')
                              : '0'}
                        </button>
                      </td>
                    ))}
                    <td className="py-1.5 px-2 text-right font-mono font-medium text-stone-700 dark:text-stone-200">
                      {formatEuro(yearTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legende */}
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-stone-500 dark:text-stone-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-100 border border-green-300" />
            Vollständig bezahlt
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
            Teilweise bezahlt
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-100 border border-red-300" />
            Offen
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700" />
            Kein Mietverhältnis
          </span>
        </div>
      </Card>

      {/* Payment Editor Dialog */}
      {editingCell && editingCellData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-stone-800 rounded-xl shadow-lg max-w-md w-full p-5">
            <h3 className="text-base font-semibold text-stone-800 dark:text-stone-100 mb-1">
              Zahlung erfassen
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
              {editingCellData.unit.name} &middot;{' '}
              {editingCellData.tenant.name} &middot;{' '}
              {MONTH_NAMES[parseInt(editingCell.month.slice(5)) - 1]}{' '}
              {editingCell.month.slice(0, 4)}
            </p>

            <div className="space-y-3">
              <div className="p-2 bg-stone-50 dark:bg-stone-800/50 rounded-lg text-xs text-stone-500 dark:text-stone-400">
                Soll-Miete: {formatEuro(editingCellData.occupancy.rentCold)}{' '}
                Kaltmiete + {formatEuro(editingCellData.occupancy.rentUtilities)}{' '}
                Nebenkosten ={' '}
                <strong className="text-stone-700 dark:text-stone-200">
                  {formatEuro(editingCellData.expected)}
                </strong>
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
                  onChange={(v) =>
                    setForm((f) => ({ ...f, amountUtilities: v }))
                  }
                  suffix="€"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                  Eingangsdatum
                </label>
                <input
                  type="date"
                  value={form.receivedDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, receivedDate: e.target.value }))
                  }
                  className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                  Zahlungsart
                </label>
                <select
                  value={form.method}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      method: e.target.value as Payment['method'],
                    }))
                  }
                  className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
                >
                  {(
                    Object.entries(METHOD_LABELS) as [
                      Payment['method'],
                      string,
                    ][]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                  Bemerkung
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Optional"
                  className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
                />
              </div>
            </div>

            <div className="flex justify-between mt-5">
              <div>
                {editingCellData.payment && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="px-3 py-2 text-sm text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                  >
                    Löschen
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingCell(null)}
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg bg-stone-800 text-white hover:bg-stone-900 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
