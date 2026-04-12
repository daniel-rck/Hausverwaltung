import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { SupplierBill } from '../../db/schema';
import { Card } from '../../components/shared/Card';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { NumInput } from '../../components/shared/NumInput';
import { formatEuro, formatNumber, formatDate } from '../../utils/format';
import { useProperty } from '../../hooks/useProperty';

interface SupplierInputProps {
  year: number;
}

interface BillForm {
  supplier: string;
  totalAmount: number;
  totalConsumption: number;
  unit: string;
  billingFrom: string;
  billingTo: string;
  notes: string;
}

const emptyForm: BillForm = {
  supplier: '',
  totalAmount: 0,
  totalConsumption: 0,
  unit: 'm³',
  billingFrom: '',
  billingTo: '',
  notes: '',
};

export function SupplierInput({ year }: SupplierInputProps) {
  const { activeProperty } = useProperty();
  const [form, setForm] = useState<BillForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const propertyId = activeProperty?.id;

  const bills = useLiveQuery(
    () =>
      propertyId != null
        ? db.supplierBills
            .where('[year+type]')
            .equals([year, 'water'])
            .filter((b) => b.propertyId === propertyId)
            .toArray()
        : Promise.resolve([] as SupplierBill[]),
    [year, propertyId],
  );

  const handleSave = useCallback(async () => {
    if (!propertyId || !form.supplier.trim() || !form.billingFrom || !form.billingTo) return;
    setSaving(true);
    try {
      const bill: Omit<SupplierBill, 'id'> = {
        propertyId,
        year,
        type: 'water',
        supplier: form.supplier.trim(),
        totalAmount: form.totalAmount,
        totalConsumption: form.totalConsumption,
        unit: form.unit,
        billingFrom: form.billingFrom,
        billingTo: form.billingTo,
        notes: form.notes.trim() || undefined,
      };
      await db.supplierBills.add(bill as SupplierBill);
      setForm({ ...emptyForm });
    } finally {
      setSaving(false);
    }
  }, [propertyId, year, form]);

  const handleDelete = useCallback(async (id: number) => {
    await db.supplierBills.delete(id);
  }, []);

  const columns: Column<SupplierBill>[] = [
    {
      key: 'supplier',
      header: 'Versorger',
      render: (row) => row.supplier,
      sortValue: (row) => row.supplier,
    },
    {
      key: 'totalAmount',
      header: 'Betrag',
      align: 'right',
      render: (row) => formatEuro(row.totalAmount),
      sortValue: (row) => row.totalAmount,
    },
    {
      key: 'totalConsumption',
      header: 'Verbrauch',
      align: 'right',
      render: (row) => `${formatNumber(row.totalConsumption)} ${row.unit}`,
      sortValue: (row) => row.totalConsumption,
    },
    {
      key: 'billingFrom',
      header: 'Von',
      render: (row) => formatDate(row.billingFrom),
      sortValue: (row) => row.billingFrom,
    },
    {
      key: 'billingTo',
      header: 'Bis',
      render: (row) => formatDate(row.billingTo),
      sortValue: (row) => row.billingTo,
    },
    {
      key: 'actions',
      header: '',
      align: 'center',
      render: (row) => (
        <button
          onClick={() => row.id != null && handleDelete(row.id)}
          className="text-red-500 hover:text-red-700 text-xs"
          title="Löschen"
        >
          Löschen
        </button>
      ),
    },
  ];

  const isValid =
    form.supplier.trim().length > 0 &&
    form.totalAmount > 0 &&
    form.totalConsumption > 0 &&
    form.billingFrom.length > 0 &&
    form.billingTo.length > 0;

  return (
    <Card title="Versorger-Daten eingeben">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">
            Versorger
          </label>
          <input
            type="text"
            value={form.supplier}
            onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
            placeholder="z.B. Stadtwerke"
            className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
        <NumInput
          label="Gesamtbetrag"
          suffix="€"
          value={form.totalAmount}
          onChange={(v) => setForm((f) => ({ ...f, totalAmount: v }))}
          min={0}
        />
        <NumInput
          label="Gesamtverbrauch"
          suffix="m³"
          value={form.totalConsumption}
          onChange={(v) => setForm((f) => ({ ...f, totalConsumption: v }))}
          min={0}
        />
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">
            Abrechnungszeitraum von
          </label>
          <input
            type="date"
            value={form.billingFrom}
            onChange={(e) => setForm((f) => ({ ...f, billingFrom: e.target.value }))}
            className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">
            Abrechnungszeitraum bis
          </label>
          <input
            type="date"
            value={form.billingTo}
            onChange={(e) => setForm((f) => ({ ...f, billingTo: e.target.value }))}
            className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">
            Hinweise
          </label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="optional"
            className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
      </div>
      <div className="flex justify-end mb-6">
        <button
          onClick={handleSave}
          disabled={!isValid || saving}
          className="px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Speichern...' : 'Rechnung speichern'}
        </button>
      </div>

      <h3 className="text-sm font-medium text-stone-600 mb-2">
        Erfasste Rechnungen ({year})
      </h3>
      <DataTable
        columns={columns}
        data={bills ?? []}
        keyFn={(row) => row.id ?? 0}
        emptyMessage="Keine Versorger-Rechnungen für dieses Jahr vorhanden."
      />
    </Card>
  );
}
