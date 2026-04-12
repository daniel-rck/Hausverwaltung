import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatDate } from '../../utils/format';
import type { Meter, MeterType, Unit } from '../../db/schema';

interface AlertRow {
  meter: Meter;
  meterType: MeterType;
  unit: Unit | null;
  daysUntilDue: number;
  status: 'green' | 'yellow' | 'red';
  statusLabel: string;
}

const ALERT_DAYS = 90;

export function CalibrationAlerts() {
  const { activeProperty } = useProperty();

  const alerts = useLiveQuery(async () => {
    if (!activeProperty?.id) return [];

    const units = await db.units
      .where('propertyId')
      .equals(activeProperty.id)
      .toArray();
    const unitIds = units.map((u) => u.id!);
    const unitMap = new Map(units.map((u) => [u.id!, u]));

    const allMeters = await db.meters.toArray();
    const propertyMeters = allMeters.filter(
      (m) => m.unitId === null || unitIds.includes(m.unitId),
    );

    const meterTypes = await db.meterTypes.toArray();
    const typeMap = new Map(meterTypes.map((t) => [t.id!, t]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows: AlertRow[] = [];

    for (const meter of propertyMeters) {
      if (!meter.calibrationDue) continue;

      const dueDate = new Date(meter.calibrationDue + 'T00:00:00');
      const diffMs = dueDate.getTime() - today.getTime();
      const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const mt = typeMap.get(meter.meterTypeId);
      if (!mt) continue;

      let status: 'green' | 'yellow' | 'red';
      let statusLabel: string;

      if (daysUntilDue < 0) {
        status = 'red';
        statusLabel = 'Abgelaufen';
      } else if (daysUntilDue <= ALERT_DAYS) {
        status = 'yellow';
        statusLabel = `${daysUntilDue} Tage`;
      } else {
        status = 'green';
        statusLabel = 'OK';
      }

      rows.push({
        meter,
        meterType: mt,
        unit: meter.unitId ? unitMap.get(meter.unitId) ?? null : null,
        daysUntilDue,
        status,
        statusLabel,
      });
    }

    // Sort: red first, then yellow, then green
    const order: Record<string, number> = { red: 0, yellow: 1, green: 2 };
    rows.sort((a, b) => order[a.status] - order[b.status] || a.daysUntilDue - b.daysUntilDue);

    return rows;
  }, [activeProperty?.id]);

  const alertRows = alerts?.filter((r) => r.status !== 'green') ?? [];

  const columns: Column<AlertRow>[] = [
    {
      key: 'serial',
      header: 'Seriennr.',
      render: (r) => <span className="font-mono text-xs">{r.meter.serialNumber}</span>,
      sortValue: (r) => r.meter.serialNumber,
    },
    {
      key: 'type',
      header: 'Typ',
      render: (r) => r.meterType.name,
      sortValue: (r) => r.meterType.name,
    },
    {
      key: 'location',
      header: 'Zuordnung',
      render: (r) =>
        r.unit ? (
          r.unit.name
        ) : (
          <span className="text-stone-500 italic">Hauptzähler</span>
        ),
    },
    {
      key: 'due',
      header: 'Eichfrist',
      render: (r) =>
        r.meter.calibrationDue ? formatDate(r.meter.calibrationDue) : '–',
      sortValue: (r) => r.meter.calibrationDue ?? '',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} label={r.statusLabel} />,
      sortValue: (r) => r.daysUntilDue,
    },
  ];

  return (
    <Card title="Eichfristen">
      {alertRows.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Alle Eichfristen in Ordnung"
          description="Keine Zähler mit ablaufenden oder abgelaufenen Eichfristen."
        />
      ) : (
        <DataTable
          columns={columns}
          data={alertRows}
          keyFn={(r) => r.meter.id!}
          emptyMessage="Keine Warnungen."
        />
      )}
    </Card>
  );
}
