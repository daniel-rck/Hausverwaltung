import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { formatEuro } from '../../utils/format';

export function QuickStats() {
  const { activeProperty } = useProperty();

  const stats = useLiveQuery(async () => {
    if (!activeProperty?.id) return null;

    const units = await db.units
      .where('propertyId')
      .equals(activeProperty.id)
      .toArray();

    const unitIds = units.map((u) => u.id!);
    const now = new Date().toISOString().slice(0, 7);

    const occupancies = await db.occupancies.toArray();
    const activeOccupancies = occupancies.filter(
      (o) =>
        unitIds.includes(o.unitId) &&
        o.from <= now &&
        (o.to === null || o.to >= now),
    );

    const occupiedCount = new Set(activeOccupancies.map((o) => o.unitId)).size;
    const vacantCount = units.length - occupiedCount;

    const monthlyRent = activeOccupancies.reduce(
      (sum, o) => sum + o.rentCold + o.rentUtilities,
      0,
    );

    return {
      totalUnits: units.length,
      occupied: occupiedCount,
      vacant: vacantCount,
      monthlyRent,
      vacancyRate: units.length > 0 ? vacantCount / units.length : 0,
    };
  }, [activeProperty?.id]);

  if (!stats) return null;

  const items = [
    { label: 'Wohneinheiten', value: String(stats.totalUnits), color: 'text-stone-700' },
    { label: 'Vermietet', value: String(stats.occupied), color: 'text-green-600' },
    { label: 'Leerstand', value: String(stats.vacant), color: stats.vacant > 0 ? 'text-amber-600' : 'text-stone-400' },
    { label: 'Monatsmiete', value: formatEuro(stats.monthlyRent), color: 'text-emerald-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <div className="text-center">
            <p className="text-xs text-stone-500 mb-1">{item.label}</p>
            <p className={`text-xl font-semibold font-mono font-tabular ${item.color}`}>
              {item.value}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
