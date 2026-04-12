import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatEuro, formatMonth } from '../../utils/format';
import type { Occupancy, Unit, Tenant, Payment } from '../../db/schema';

interface OpenItem {
  id: string;
  unit: Unit;
  tenant: Tenant;
  occupancy: Occupancy;
  month: string;
  expected: number;
  received: number;
  difference: number;
  status: 'red' | 'yellow';
}

interface OpenItemsProps {
  year: number;
}

export function OpenItems({ year }: OpenItemsProps) {
  const { activeProperty } = useProperty();

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

  const items = useMemo((): OpenItem[] => {
    if (!data) return [];

    const { occupancies, unitMap, tenantMap, paymentMap } = data;
    const result: OpenItem[] = [];

    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;

    // Only consider months up to current month
    const now = new Date();
    const currentMonth =
      now.getFullYear() === year
        ? `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`
        : yearEnd;

    for (const occ of occupancies) {
      if (occ.from > yearEnd || (occ.to !== null && occ.to < yearStart))
        continue;

      const unit = unitMap.get(occ.unitId);
      const tenant = tenantMap.get(occ.tenantId);
      if (!unit || !tenant) continue;

      for (let m = 1; m <= 12; m++) {
        const month = `${year}-${String(m).padStart(2, '0')}`;
        if (month > currentMonth) break;
        if (month < occ.from) continue;
        if (occ.to !== null && month > occ.to) continue;

        const expected = occ.rentCold + occ.rentUtilities;
        const payment = paymentMap.get(`${occ.id}-${month}`);
        const received = payment
          ? payment.amountCold + payment.amountUtilities
          : 0;

        if (received < expected) {
          result.push({
            id: `${occ.id}-${month}`,
            unit,
            tenant,
            occupancy: occ,
            month,
            expected,
            received,
            difference: expected - received,
            status: received > 0 ? 'yellow' : 'red',
          });
        }
      }
    }

    // Sort most recent first
    result.sort((a, b) => b.month.localeCompare(a.month));

    return result;
  }, [data, year]);

  if (!data) return null;

  const columns: Column<OpenItem>[] = [
    {
      key: 'unit',
      header: 'Einheit',
      render: (row) => (
        <span className="font-medium text-stone-700">{row.unit.name}</span>
      ),
      sortValue: (row) => row.unit.name,
    },
    {
      key: 'tenant',
      header: 'Mieter',
      render: (row) => row.tenant.name,
      sortValue: (row) => row.tenant.name,
    },
    {
      key: 'month',
      header: 'Monat',
      render: (row) => formatMonth(row.month),
      sortValue: (row) => row.month,
    },
    {
      key: 'expected',
      header: 'Soll',
      align: 'right',
      render: (row) => (
        <span className="font-mono">{formatEuro(row.expected)}</span>
      ),
      sortValue: (row) => row.expected,
    },
    {
      key: 'received',
      header: 'Ist',
      align: 'right',
      render: (row) => (
        <span className="font-mono">{formatEuro(row.received)}</span>
      ),
      sortValue: (row) => row.received,
    },
    {
      key: 'difference',
      header: 'Differenz',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-medium text-red-600">
          {formatEuro(row.difference)}
        </span>
      ),
      sortValue: (row) => row.difference,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge
          status={row.status}
          label={row.status === 'red' ? 'Offen' : 'Teilweise'}
        />
      ),
    },
  ];

  const totalDifference = items.reduce((s, i) => s + i.difference, 0);

  return (
    <Card
      title="Offene Posten"
      action={
        items.length > 0 ? (
          <span className="text-sm font-medium text-red-600">
            Gesamt offen: {formatEuro(totalDifference)}
          </span>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Keine offenen Posten"
          description={`Alle Mietzahlungen für ${year} sind vollständig eingegangen.`}
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          keyFn={(row) => row.id}
          emptyMessage="Keine offenen Posten vorhanden."
        />
      )}
    </Card>
  );
}
