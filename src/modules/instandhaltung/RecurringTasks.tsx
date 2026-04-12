import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { EmptyState } from '../../components/shared/EmptyState';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDate } from '../../utils/format';
import type { MaintenanceItem, Unit } from '../../db/schema';

const CATEGORY_LABELS: Record<MaintenanceItem['category'], string> = {
  repair: 'Reparatur',
  maintenance: 'Wartung',
  inspection: 'Prüfung',
  modernization: 'Modernisierung',
};

interface RecurringRow {
  item: MaintenanceItem;
  unitName: string;
  isOverdue: boolean;
}

export function RecurringTasks() {
  const { activeProperty } = useProperty();

  const units = useLiveQuery(
    () =>
      activeProperty?.id
        ? db.units.where('propertyId').equals(activeProperty.id).toArray()
        : Promise.resolve([] as Unit[]),
    [activeProperty?.id],
  );

  const unitIds = useMemo(() => (units ?? []).map((u) => u.id!), [units]);
  const unitMap = useMemo(() => {
    const map = new Map<number, Unit>();
    for (const u of units ?? []) {
      map.set(u.id!, u);
    }
    return map;
  }, [units]);

  const items = useLiveQuery(
    async () => {
      if (!activeProperty?.id) return [];
      const all = await db.maintenanceItems.toArray();
      return all.filter(
        (item) =>
          item.recurring &&
          (item.unitId === null || unitIds.includes(item.unitId)),
      );
    },
    [activeProperty?.id, unitIds],
  );

  const today = new Date().toISOString().slice(0, 10);

  const rows: RecurringRow[] = useMemo(() => {
    if (!items) return [];
    return items
      .map((item) => ({
        item,
        unitName:
          item.unitId === null
            ? 'Gemeinschaft'
            : (unitMap.get(item.unitId)?.name ?? 'Unbekannt'),
        isOverdue: item.nextDue ? item.nextDue < today : false,
      }))
      .sort((a, b) => {
        // Overdue first, then by next due date
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        const aDue = a.item.nextDue ?? '9999-12-31';
        const bDue = b.item.nextDue ?? '9999-12-31';
        return aDue.localeCompare(bDue);
      });
  }, [items, unitMap, today]);

  const columns: Column<RecurringRow>[] = [
    {
      key: 'title',
      header: 'Aufgabe',
      render: (r) => (
        <span className={`font-medium ${r.isOverdue ? 'text-red-700' : ''}`}>
          {r.item.title}
        </span>
      ),
      sortValue: (r) => r.item.title,
    },
    {
      key: 'unit',
      header: 'Wohnung',
      render: (r) => (
        <span className={r.item.unitId === null ? 'text-stone-500 italic' : ''}>
          {r.unitName}
        </span>
      ),
      sortValue: (r) => r.unitName,
    },
    {
      key: 'category',
      header: 'Kategorie',
      render: (r) => CATEGORY_LABELS[r.item.category],
      sortValue: (r) => CATEGORY_LABELS[r.item.category],
    },
    {
      key: 'interval',
      header: 'Intervall',
      render: (r) =>
        r.item.recurringInterval
          ? `${r.item.recurringInterval} Monat${r.item.recurringInterval > 1 ? 'e' : ''}`
          : <span className="text-stone-400">–</span>,
      sortValue: (r) => r.item.recurringInterval ?? 0,
      align: 'center',
    },
    {
      key: 'lastDone',
      header: 'Zuletzt erledigt',
      render: (r) => formatDate(r.item.date),
      sortValue: (r) => r.item.date,
    },
    {
      key: 'nextDue',
      header: 'Nächste Fälligkeit',
      render: (r) => {
        if (!r.item.nextDue) return <span className="text-stone-400">–</span>;
        return (
          <span className={r.isOverdue ? 'text-red-600 font-semibold' : ''}>
            {formatDate(r.item.nextDue)}
          </span>
        );
      },
      sortValue: (r) => r.item.nextDue ?? '9999-12-31',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        if (!r.item.nextDue) {
          return <StatusBadge status="gray" label="Kein Termin" />;
        }
        if (r.isOverdue) {
          return <StatusBadge status="red" label="Überfällig" />;
        }
        const dueDate = new Date(r.item.nextDue);
        const todayDate = new Date(today);
        const diffDays = Math.ceil(
          (dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays <= 30) {
          return <StatusBadge status="yellow" label="Bald fällig" />;
        }
        return <StatusBadge status="green" label="In Ordnung" />;
      },
    },
  ];

  return (
    <Card title="Wiederkehrende Aufgaben">
      {rows.length === 0 ? (
        <EmptyState
          icon="🔁"
          title="Keine wiederkehrenden Aufgaben"
          description="Markieren Sie Maßnahmen als wiederkehrend, um sie hier zu sehen."
        />
      ) : (
        <>
          {rows.some((r) => r.isOverdue) && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {rows.filter((r) => r.isOverdue).length} Aufgabe(n) überfällig
            </div>
          )}
          <DataTable
            columns={columns}
            data={rows}
            keyFn={(r) => r.item.id!}
          />
        </>
      )}
    </Card>
  );
}
