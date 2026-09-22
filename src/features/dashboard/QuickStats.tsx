import { db, useLiveQuery } from "../../lib/db";
import { useProperty } from "../../lib/hooks/useProperty";
import { KpiTile } from "../../lib/ui/ui";
import { currentMonth } from "../../lib/utils/dates";
import { formatEuro } from "../../lib/utils/format";
import { buildRentLookup } from "../../lib/utils/rent";

export function QuickStats() {
  const { activeProperty } = useProperty();

  const stats = useLiveQuery(async () => {
    if (!activeProperty?.id) return null;

    const units = await db.units.where("propertyId").equals(activeProperty.id).toArray();

    const unitIds = units.flatMap((u) => (u.id === undefined ? [] : [u.id]));
    const now = currentMonth();

    const occupancies = await db.occupancies.toArray();
    const activeOccupancies = occupancies.filter(
      (o) => unitIds.includes(o.unitId) && o.from <= now && (o.to === null || o.to >= now),
    );

    const occupiedCount = new Set(activeOccupancies.map((o) => o.unitId)).size;
    const vacantCount = units.length - occupiedCount;

    const rentAt = buildRentLookup(await db.rentChanges.toArray());
    const monthlyRent = activeOccupancies.reduce(
      (sum, o) => sum + rentAt(o, now) + o.rentUtilities,
      0,
    );

    return {
      totalUnits: units.length,
      occupied: occupiedCount,
      vacant: vacantCount,
      monthlyRent,
    };
  }, [activeProperty?.id]);

  const loading = stats === undefined;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiTile
        label="Wohneinheiten"
        value={loading ? "…" : String(stats?.totalUnits ?? 0)}
        loading={loading}
      />
      <KpiTile
        label="Vermietet"
        value={loading ? "…" : String(stats?.occupied ?? 0)}
        accent="mieter"
        loading={loading}
      />
      <KpiTile
        label="Leerstand"
        value={loading ? "…" : String(stats?.vacant ?? 0)}
        hint={stats && stats.vacant > 0 ? "Aktion empfohlen" : undefined}
        accent={stats && stats.vacant > 0 ? "nebenkosten" : undefined}
        loading={loading}
      />
      <KpiTile
        label="Monatsmiete"
        value={loading ? "…" : formatEuro(stats?.monthlyRent ?? 0)}
        accent="finanzen"
        loading={loading}
      />
    </div>
  );
}
