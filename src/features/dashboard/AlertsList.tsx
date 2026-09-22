import { db, useLiveQuery } from "../../lib/db";
import { isMaintenanceForProperty } from "../../lib/db/queries";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import type { LucideIcon } from "../../lib/ui/ui/icons";
import { AlertTriangle, Gauge, Home, Wrench } from "../../lib/ui/ui/icons";
import { currentMonth, isoInDays, todayIso } from "../../lib/utils/dates";
import { formatDate } from "../../lib/utils/format";

type AlertKind = "vacant" | "maintenance" | "calibration";
type Severity = "warning" | "info";

interface Alert {
  kind: AlertKind;
  severity: Severity;
  message: string;
}

const iconMap: Record<AlertKind, LucideIcon> = {
  vacant: Home,
  maintenance: Wrench,
  calibration: Gauge,
};

export function AlertsList() {
  const { activeProperty } = useProperty();

  const alerts = useLiveQuery(async () => {
    if (!activeProperty?.id) return [];

    const result: Alert[] = [];
    const now = currentMonth();
    const today = todayIso();

    const propertyId = activeProperty.id;
    const units = await db.units.where("propertyId").equals(propertyId).toArray();
    const unitIds = units.flatMap((u) => (u.id === undefined ? [] : [u.id]));

    // Leerstand
    const occupancies = await db.occupancies.toArray();
    const occupiedIds = new Set(
      occupancies
        .filter(
          (o) => unitIds.includes(o.unitId) && o.from <= now && (o.to === null || o.to >= now),
        )
        .map((o) => o.unitId),
    );

    const vacantUnits = units.filter((u) => u.id !== undefined && !occupiedIds.has(u.id));
    for (const u of vacantUnits) {
      result.push({ kind: "vacant", severity: "warning", message: `${u.name} steht leer` });
    }

    // Fällige Wartungen
    const maintenance = await db.maintenanceItems.toArray();
    const dueSoon = maintenance.filter(
      (m) =>
        m.nextDue && m.nextDue <= isoInDays(30) && isMaintenanceForProperty(m, propertyId, unitIds),
    );
    for (const m of dueSoon) {
      const due = m.nextDue ?? "";
      const overdue = due < today;
      result.push({
        kind: "maintenance",
        severity: overdue ? "warning" : "info",
        message: `${m.title} ${overdue ? "überfällig seit" : "fällig am"} ${formatDate(due)}`,
      });
    }

    // Eichfristen
    const meters = await db.meters.toArray();
    const soonExpiring = meters.filter(
      (m) =>
        m.calibrationDue &&
        m.calibrationDue <= isoInDays(90) &&
        (m.unitId === null || unitIds.includes(m.unitId)),
    );
    for (const m of soonExpiring) {
      result.push({
        kind: "calibration",
        severity: "warning",
        message: `Zähler ${m.serialNumber}: Eichfrist ${(m.calibrationDue ?? "") < today ? "abgelaufen" : "läuft ab"} (${formatDate(m.calibrationDue ?? "")})`,
      });
    }

    return result;
  }, [activeProperty?.id]);

  if (!alerts || alerts.length === 0) {
    return (
      <Card title="Heute zu tun">
        <p className="text-sm text-fg-muted">Alles erledigt — keine offenen Hinweise.</p>
      </Card>
    );
  }

  return (
    <Card
      title="Heute zu tun"
      description={`${alerts.length} offene${alerts.length === 1 ? "r Hinweis" : " Hinweise"}`}
    >
      <ul className="space-y-2">
        {alerts.slice(0, 8).map((alert) => {
          const Icon = iconMap[alert.kind] ?? AlertTriangle;
          const iconColor =
            alert.severity === "warning" ? "text-warning" : "text-accent dark:text-accent-dark";
          return (
            <li key={alert.message} className="flex items-start gap-3 text-sm text-fg">
              <Icon
                size={16}
                strokeWidth={1.75}
                className={`mt-0.5 shrink-0 ${iconColor}`}
                aria-hidden="true"
              />
              <span className="min-w-0">{alert.message}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
