import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { NumInput } from '../../components/shared/NumInput';
import { EmptyState } from '../../components/shared/EmptyState';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatEuro, formatDate } from '../../utils/format';
import type { Occupancy, DepositEvent, DepositEventType } from '../../db/schema';

interface DepositManagerProps {
  occupancy: Occupancy;
}

const EVENT_TYPE_LABELS: Record<DepositEventType, string> = {
  payment: 'Einzahlung',
  interest: 'Verzinsung',
  deduction: 'Abzug',
  refund: 'Erstattung',
};

export function DepositManager({ occupancy }: DepositManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: '',
    type: 'payment' as DepositEventType,
    amount: 0,
    description: '',
  });

  const events = useLiveQuery(
    () =>
      db.depositEvents
        .where('occupancyId')
        .equals(occupancy.id!)
        .toArray()
        .then((rows) => rows.sort((a, b) => a.date.localeCompare(b.date))),
    [occupancy.id],
  );

  const balance = useMemo(() => {
    if (!events) return 0;
    return events.reduce((sum, e) => {
      switch (e.type) {
        case 'payment':
          return sum + e.amount;
        case 'interest':
          return sum + e.amount;
        case 'deduction':
          return sum - e.amount;
        case 'refund':
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

    const [y, m] = occupancy.to.split('-').map(Number);
    const deadline = new Date(Date.UTC(y, m - 1 + 6, 1));

    const now = new Date();
    if (now > deadline) {
      const dd = String(deadline.getUTCDate()).padStart(2, '0');
      const mm = String(deadline.getUTCMonth() + 1).padStart(2, '0');
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

    setForm({ date: '', type: 'payment', amount: 0, description: '' });
    setShowForm(false);
  };

  const columns: Column<DepositEvent>[] = [
    {
      key: 'date',
      header: 'Datum',
      render: (r) => formatDate(r.date),
      sortValue: (r) => r.date,
    },
    {
      key: 'type',
      header: 'Art',
      render: (r) => EVENT_TYPE_LABELS[r.type],
    },
    {
      key: 'amount',
      header: 'Betrag',
      render: (r) => {
        const isNegative = r.type === 'deduction' || r.type === 'refund';
        return (
          <span className={`font-mono ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {isNegative ? '−' : '+'}{formatEuro(r.amount)}
          </span>
        );
      },
      align: 'right',
      sortValue: (r) => r.amount,
    },
    {
      key: 'description',
      header: 'Beschreibung',
      render: (r) => (
        <span className="text-stone-500 dark:text-stone-400 truncate max-w-[200px] inline-block">
          {r.description ?? '–'}
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
        <div className="p-3 bg-stone-50 dark:bg-stone-700/30 rounded-lg">
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-0.5">Soll-Kaution</p>
          <p className="font-semibold font-mono text-stone-800 dark:text-stone-100">
            {formatEuro(occupancy.deposit)}
          </p>
        </div>
        <div className="p-3 bg-stone-50 dark:bg-stone-700/30 rounded-lg">
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-0.5">Eingezahlt</p>
          <p className="font-semibold font-mono text-stone-800 dark:text-stone-100">
            {formatEuro(balance)}
          </p>
        </div>
        <div className="p-3 bg-stone-50 dark:bg-stone-700/30 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-0.5">Status</p>
            <p className="font-semibold font-mono text-stone-800 dark:text-stone-100">
              {isPaid ? formatEuro(0) : formatEuro(remaining)}
            </p>
          </div>
          <StatusBadge
            status={isPaid ? 'green' : 'red'}
            label={isPaid ? 'Bezahlt' : 'Offen'}
          />
        </div>
      </div>

      {/* Move-out warning */}
      {moveoutWarning && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            ⚠ {moveoutWarning}
          </p>
        </div>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="mb-4 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-200 dark:border-stone-700">
          <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-3">
            Vorgang erfassen
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                Datum *
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                Art *
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as DepositEventType })}
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              >
                <option value="payment">Einzahlung</option>
                <option value="interest">Verzinsung</option>
                <option value="deduction">Abzug</option>
                <option value="refund">Erstattung</option>
              </select>
            </div>
            <NumInput
              label="Betrag *"
              value={form.amount}
              onChange={(v) => setForm({ ...form, amount: v })}
              suffix="€"
              min={0}
            />
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                Beschreibung
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
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

      {/* Events table */}
      {events && events.length > 0 ? (
        <DataTable columns={columns} data={events} keyFn={(r) => r.id!} />
      ) : (
        <EmptyState
          icon="🏦"
          title="Keine Kautionsvorgänge"
          description="Erfassen Sie Einzahlungen, Verzinsungen oder Rückerstattungen."
        />
      )}
    </Card>
  );
}
