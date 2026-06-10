import { useMemo } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { MaintenanceItem, Unit } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { type Column, DataTable } from "../../lib/ui/shared/DataTable";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { StatusBadge } from "../../lib/ui/shared/StatusBadge";
import { ClipboardList } from "../../lib/ui/ui/icons";
import { formatDate, formatEuro } from "../../lib/utils/format";

const CATEGORY_LABELS: Record<MaintenanceItem["category"], string> = {
  repair: "Reparatur",
  maintenance: "Wartung",
  inspection: "Prüfung",
  modernization: "Modernisierung",
};

type DueStatus = "green" | "yellow" | "red";

interface DueRow {
  item: MaintenanceItem;
  unitName: string;
  daysUntilDue: number;
  status: DueStatus;
}

function getDueStatus(nextDue: string, today: string): { daysUntilDue: number; status: DueStatus } {
  const dueDate = new Date(nextDue);
  const todayDate = new Date(today);
  const diffMs = dueDate.getTime() - todayDate.getTime();
  const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) return { daysUntilDue, status: "red" };
  if (daysUntilDue <= 30) return { daysUntilDue, status: "yellow" };
  return { daysUntilDue, status: "green" };
}

const STATUS_LABELS: Record<DueStatus, string> = {
  red: "Überfällig",
  yellow: "Bald fällig",
  green: "Geplant",
};

export function UpcomingDue() {
  const { activeProperty } = useProperty();

  const units = useLiveQuery(
    () =>
      activeProperty?.id
        ? db.units.where("propertyId").equals(activeProperty.id).toArray()
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

  const today = new Date().toISOString().slice(0, 10);

  const items = useLiveQuery(async () => {
    if (!activeProperty?.id) return [];
    const all = await db.maintenanceItems.toArray();
    return all.filter(
      (item) =>
        item.nextDue !== undefined &&
        item.nextDue !== "" &&
        (item.unitId === null || unitIds.includes(item.unitId)),
    );
  }, [activeProperty?.id, unitIds]);

  const rows: DueRow[] = useMemo(() => {
    if (!items) return [];
    return items
      .map((item) => {
        const { daysUntilDue, status } = getDueStatus(item.nextDue!, today);
        return {
          item,
          unitName:
            item.unitId === null ? "Gemeinschaft" : (unitMap.get(item.unitId)?.name ?? "Unbekannt"),
          daysUntilDue,
          status,
        };
      })
      .filter((r) => r.status === "red" || r.status === "yellow")
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [items, unitMap, today]);

  const columns: Column<DueRow>[] = [
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} label={STATUS_LABELS[r.status]} />,
      sortValue: (r) => r.daysUntilDue,
    },
    {
      key: "nextDue",
      header: "Fällig am",
      render: (r) => (
        <span className={r.status === "red" ? "text-red-600 font-semibold" : ""}>
          {formatDate(r.item.nextDue!)}
        </span>
      ),
      sortValue: (r) => r.item.nextDue!,
    },
    {
      key: "days",
      header: "Tage",
      render: (r) => {
        if (r.daysUntilDue < 0) {
          return (
            <span className="text-red-600 font-medium">
              {Math.abs(r.daysUntilDue)} Tage überfällig
            </span>
          );
        }
        if (r.daysUntilDue === 0) {
          return <span className="text-amber-600 font-medium">Heute fällig</span>;
        }
        return (
          <span className="text-amber-600">
            noch {r.daysUntilDue} Tag{r.daysUntilDue !== 1 ? "e" : ""}
          </span>
        );
      },
      sortValue: (r) => r.daysUntilDue,
      align: "center",
    },
    {
      key: "title",
      header: "Aufgabe",
      render: (r) => <span className="font-medium">{r.item.title}</span>,
      sortValue: (r) => r.item.title,
    },
    {
      key: "unit",
      header: "Wohnung",
      render: (r) => (
        <span className={r.item.unitId === null ? "text-fg-muted italic" : ""}>{r.unitName}</span>
      ),
      sortValue: (r) => r.unitName,
    },
    {
      key: "category",
      header: "Kategorie",
      render: (r) => CATEGORY_LABELS[r.item.category],
      sortValue: (r) => CATEGORY_LABELS[r.item.category],
    },
    {
      key: "cost",
      header: "Kosten",
      render: (r) => <span className="font-mono">{formatEuro(r.item.cost)}</span>,
      sortValue: (r) => r.item.cost,
      align: "right",
    },
  ];

  return (
    <Card title="Fällige Aufgaben">
      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={24} strokeWidth={1.75} />}
          title="Keine fälligen Aufgaben"
          description="Es stehen aktuell keine Maßnahmen in den nächsten 30 Tagen an."
        />
      ) : (
        <>
          <div className="mb-3 flex gap-3 text-sm text-fg-muted">
            <span>{rows.filter((r) => r.status === "red").length} überfällig</span>
            <span className="text-zinc-300">|</span>
            <span>{rows.filter((r) => r.status === "yellow").length} in den nächsten 30 Tagen</span>
          </div>
          <DataTable columns={columns} data={rows} keyFn={(r) => r.item.id!} />
        </>
      )}
    </Card>
  );
}
