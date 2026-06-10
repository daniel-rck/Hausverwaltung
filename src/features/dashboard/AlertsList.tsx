import { db, useLiveQuery } from "../../lib/db";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import type { LucideIcon } from "../../lib/ui/ui/icons";
import { AlertTriangle, Gauge, Home, Wrench } from "../../lib/ui/ui/icons";

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
    const now = new Date().toISOString().slice(0, 7);
    const today = new Date().toISOString().slice(0, 10);

    const units = await db.units.where("propertyId").equals(activeProperty.id).toArray();
    const unitIds = units.map((u) => u.id!);

    // Leerstand
    const occupancies = await db.occupancies.toArray();
    const occupiedIds = new Set(
      occupancies
        .filter(
          (o) => unitIds.includes(o.unitId) && o.from <= now && (o.to === null || o.to >= now),
        )
        .map((o) => o.unitId),
    );

    const vacantUnits = units.filter((u) => !occupiedIds.has(u.id!));
    for (const u of vacantUnits) {
      result.push({ kind: "vacant", severity: "warning", message: `${u.name} steht leer` });
    }

    // Fällige Wartungen
    const maintenance = await db.maintenanceItems.toArray();
    const dueSoon = maintenance.filter(
      (m) =>
        m.nextDue &&
        m.nextDue <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) &&
        m.nextDue >= today,
    );
    for (const m of dueSoon) {
      result.push({
        kind: "maintenance",
        severity: "info",
        message: `${m.title} fällig am ${m.nextDue}`,
      });
    }

    // Eichfristen
    const meters = await db.meters.toArray();
    const soonExpiring = meters.filter(
      (m) =>
        m.calibrationDue &&
        m.calibrationDue <= new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    );
    for (const m of soonExpiring) {
      result.push({
        kind: "calibration",
        severity: "warning",
        message: `Zähler ${m.serialNumber}: Eichfrist läuft ab (${m.calibrationDue})`,
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
            alert.severity === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : "text-[--color-accent] dark:text-[--color-accent-dark]";
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
