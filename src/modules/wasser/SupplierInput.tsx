import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteWithTombstone } from '../../db';
import type { SupplierBill } from '../../db/schema';
import { Card } from '../../components/shared/Card';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { NumInput } from '../../components/shared/NumInput';
import { formatEuro, formatNumber, formatDate } from '../../utils/format';
import { useProperty } from '../../hooks/useProperty';

type SupplierType = 'water' | 'gas' | 'electricity' | 'heating';

interface SupplierInputProps {
  year: number;
  type: SupplierType;
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

const typeConfig: Record<SupplierType, { label: string; defaultUnit: string; units: string[] }> = {
  water: { label: 'Wasserversorger', defaultUnit: 'm³', units: ['m³'] },
  gas: { label: 'Gasversorger', defaultUnit: 'm³', units: ['m³', 'kWh'] },
  electricity: { label: 'Stromversorger', defaultUnit: 'kWh', units: ['kWh'] },
  heating: { label: 'Fernwärme/Heizung', defaultUnit: 'kWh', units: ['kWh', 'MWh'] },
};

function makeEmptyForm(type: SupplierType): BillForm {
  return {
    supplier: '',
    totalAmount: 0,
    totalConsumption: 0,
    unit: typeConfig[type].defaultUnit,
    billingFrom: '',
    billingTo: '',
    notes: '',
  };
}

export function SupplierInput({ year, type }: SupplierInputProps) {
  const { activeProperty } = useProperty();
  const [form, setForm] = useState<BillForm>(() => makeEmptyForm(type));
  const [saving, setSaving] = useState(false);

  const config = typeConfig[type];
  const propertyId = activeProperty?.id;

  const bills = useLiveQuery(
    () =>
      propertyId != null
        ? db.supplierBills
            .where('[year+type]')
            .equals([year, type])
            .filter((b) => b.propertyId === propertyId)
            .toArray()
        : Promise.resolve([] as SupplierBill[]),
    [year, type, propertyId],
  );

  const handleSave = useCallback(async () => {
    if (!propertyId || !form.supplier.trim() || !form.billingFrom || !form.billingTo) return;
    setSaving(true);
    try {
      const bill: Omit<SupplierBill, 'id'> = {
        propertyId,
        year,
        type,
        supplier: form.supplier.trim(),
        totalAmount: form.totalAmount,
        totalConsumption: form.totalConsumption,
        unit: form.unit,
        billingFrom: form.billingFrom,
        billingTo: form.billingTo,
        notes: form.notes.trim() || undefined,
      };
      await db.supplierBills.add(bill as SupplierBill);
      setForm(makeEmptyForm(type));
    } finally {
      setSaving(false);
    }
  }, [propertyId, year, type, form]);

  const handleDelete = useCallback(async (id: number) => {
    await deleteWithTombstone('supplierBills', id);
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
    <Card title={`${config.label} – Daten eingeben`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
            {config.label}
          </label>
          <input
            type="text"
            value={form.supplier}
            onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
            placeholder="z.B. Stadtwerke"
            className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
          />
        </div>
        <NumInput
          label="Gesamtbetrag"
          suffix="€"
          value={form.totalAmount}
          onChange={(v) => setForm((f) => ({ ...f, totalAmount: v }))}
          min={0}
        />
        <div>
          <NumInput
            label="Gesamtverbrauch"
            suffix={form.unit}
            value={form.totalConsumption}
            onChange={(v) => setForm((f) => ({ ...f, totalConsumption: v }))}
            min={0}
          />
          {config.units.length > 1 && (
            <select
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              className="mt-1 border border-stone-300 dark:border-stone-600 rounded-lg px-2 py-1 text-xs bg-white dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
            >
              {config.units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
            Abrechnungszeitraum von
          </label>
          <input
            type="date"
            value={form.billingFrom}
            onChange={(e) => setForm((f) => ({ ...f, billingFrom: e.target.value }))}
            className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
            Abrechnungszeitraum bis
          </label>
          <input
            type="date"
            value={form.billingTo}
            onChange={(e) => setForm((f) => ({ ...f, billingTo: e.target.value }))}
            className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
            Hinweise
          </label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="optional"
            className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
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

      <h3 className="text-sm font-medium text-stone-600 dark:text-stone-300 mb-2">
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
