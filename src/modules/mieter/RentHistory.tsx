import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { NumInput } from '../../components/shared/NumInput';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatEuro, formatMonth } from '../../utils/format';
import type { Occupancy, Unit, RentChange, RentChangeReason } from '../../db/schema';

interface RentHistoryProps {
  occupancy: Occupancy;
  unit: Unit;
}

const REASON_LABELS: Record<RentChangeReason, string> = {
  mietspiegel: 'Mietspiegel',
  index: 'Indexanpassung',
  modernization: 'Modernisierung',
  agreement: 'Vereinbarung',
};

export function RentHistory({ occupancy, unit }: RentHistoryProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    effectiveDate: '',
    newRentCold: occupancy.rentCold,
    reason: 'mietspiegel' as RentChangeReason,
    notes: '',
  });

  const changes = useLiveQuery(
    () =>
      db.rentChanges
        .where('occupancyId')
        .equals(occupancy.id!)
        .toArray()
        .then((rows) => rows.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))),
    [occupancy.id],
  );

  const handleSave = async () => {
    if (!form.effectiveDate || form.newRentCold <= 0) return;

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
      effectiveDate: '',
      newRentCold: form.newRentCold,
      reason: 'mietspiegel',
      notes: '',
    });
    setShowForm(false);
  };

  const columns: Column<RentChange>[] = [
    {
      key: 'effectiveDate',
      header: 'Datum',
      render: (r) => formatMonth(r.effectiveDate),
      sortValue: (r) => r.effectiveDate,
    },
    {
      key: 'oldRentCold',
      header: 'Alte Miete',
      render: (r) => <span className="font-mono">{formatEuro(r.oldRentCold)}</span>,
      align: 'right',
      sortValue: (r) => r.oldRentCold,
    },
    {
      key: 'newRentCold',
      header: 'Neue Miete',
      render: (r) => <span className="font-mono">{formatEuro(r.newRentCold)}</span>,
      align: 'right',
      sortValue: (r) => r.newRentCold,
    },
    {
      key: 'diff',
      header: 'Differenz',
      render: (r) => {
        const diff = r.newRentCold - r.oldRentCold;
        const cls = diff > 0 ? 'text-red-600 dark:text-red-400' : diff < 0 ? 'text-green-600 dark:text-green-400' : '';
        return <span className={`font-mono ${cls}`}>{diff > 0 ? '+' : ''}{formatEuro(diff)}</span>;
      },
      align: 'right',
    },
    {
      key: 'reason',
      header: 'Grund',
      render: (r) => REASON_LABELS[r.reason],
    },
    {
      key: 'notes',
      header: 'Notiz',
      render: (r) => (
        <span className="text-stone-500 dark:text-stone-400 truncate max-w-[200px] inline-block">
          {r.notes ?? '–'}
        </span>
      ),
    },
  ];

  return (
    <Card
      title={`Miethistorie – ${unit.name}`}
      action={
        !showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Mieterhöhung erfassen
          </button>
        ) : undefined
      }
    >
      {/* Current rent display */}
      <div className="mb-4 p-3 bg-stone-50 dark:bg-stone-700/30 rounded-lg">
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Aktuelle Kaltmiete:{' '}
          <span className="font-semibold font-mono text-stone-800 dark:text-stone-100">
            {formatEuro(occupancy.rentCold)}
          </span>
        </p>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="mb-4 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-200 dark:border-stone-700">
          <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-3">
            Mieterhöhung erfassen
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                Wirksam ab *
              </label>
              <input
                type="month"
                value={form.effectiveDate}
                onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
            <NumInput
              label="Neue Kaltmiete *"
              value={form.newRentCold}
              onChange={(v) => setForm({ ...form, newRentCold: v })}
              suffix="€"
              min={0}
            />
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                Grund *
              </label>
              <select
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value as RentChangeReason })}
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              >
                <option value="mietspiegel">Mietspiegel</option>
                <option value="index">Indexanpassung</option>
                <option value="modernization">Modernisierung</option>
                <option value="agreement">Vereinbarung</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                Notiz
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-stone-800 dark:bg-stone-600 text-white rounded-lg hover:bg-stone-900 dark:hover:bg-stone-500 transition-colors"
            >
              Speichern
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
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
          icon="📈"
          title="Keine Mietänderungen"
          description="Erfassen Sie Mieterhöhungen, um die Miethistorie nachzuverfolgen."
        />
      )}
    </Card>
  );
}
