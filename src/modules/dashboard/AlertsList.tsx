import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';

interface Alert {
  type: 'warning' | 'info';
  message: string;
}

export function AlertsList() {
  const { activeProperty } = useProperty();

  const alerts = useLiveQuery(async () => {
    if (!activeProperty?.id) return [];

    const result: Alert[] = [];
    const now = new Date().toISOString().slice(0, 7);
    const today = new Date().toISOString().slice(0, 10);

    const units = await db.units
      .where('propertyId')
      .equals(activeProperty.id)
      .toArray();
    const unitIds = units.map((u) => u.id!);

    // Leerstand
    const occupancies = await db.occupancies.toArray();
    const occupiedIds = new Set(
      occupancies
        .filter(
          (o) =>
            unitIds.includes(o.unitId) &&
            o.from <= now &&
            (o.to === null || o.to >= now),
        )
        .map((o) => o.unitId),
    );

    const vacantUnits = units.filter((u) => !occupiedIds.has(u.id!));
    for (const u of vacantUnits) {
      result.push({
        type: 'warning',
        message: `${u.name} steht leer`,
      });
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
        type: 'info',
        message: `${m.title} fällig am ${m.nextDue}`,
      });
    }

    // Eichfristen
    const meters = await db.meters.toArray();
    const soonExpiring = meters.filter(
      (m) =>
        m.calibrationDue &&
        m.calibrationDue <=
          new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    );
    for (const m of soonExpiring) {
      result.push({
        type: 'warning',
        message: `Zähler ${m.serialNumber}: Eichfrist läuft ab (${m.calibrationDue})`,
      });
    }

    return result;
  }, [activeProperty?.id]);

  if (!alerts || alerts.length === 0) {
    return (
      <Card title="Hinweise">
        <p className="text-sm text-stone-500 dark:text-stone-400">Keine aktuellen Hinweise.</p>
      </Card>
    );
  }

  return (
    <Card title="Hinweise">
      <ul className="space-y-2">
        {alerts.map((alert, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 text-sm ${
              alert.type === 'warning' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'
            }`}
          >
            <span>{alert.type === 'warning' ? '⚠' : 'ℹ'}</span>
            {alert.message}
          </li>
        ))}
      </ul>
    </Card>
  );
}
