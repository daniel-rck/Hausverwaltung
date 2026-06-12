import { db, useLiveQuery } from "../../lib/db";
import type { Meter, MeterReading, MeterType, Unit } from "../../lib/db/schema";

export interface MeterOption {
  meter: Meter;
  meterType: MeterType;
  unit: Unit | null;
  label: string;
}

export const SOURCE_LABELS: Record<MeterReading["source"], string> = {
  self: "Eigene Ablesung",
  messdienst: "Messdienstleister",
  versorger: "Versorger",
};

/** All meters of a property (incl. Hauptzähler) with type and unit labels. */
export function useMeterOptions(propertyId: number | undefined): MeterOption[] | undefined {
  return useLiveQuery(async (): Promise<MeterOption[]> => {
    if (!propertyId) return [];

    const units = await db.units.where("propertyId").equals(propertyId).toArray();
    const unitIds = units.map((u) => u.id!);
    const unitMap = new Map(units.map((u) => [u.id!, u]));

    const allMeters = await db.meters.toArray();
    const propertyMeters = allMeters.filter((m) => m.unitId === null || unitIds.includes(m.unitId));

    const meterTypes = await db.meterTypes.toArray();
    const typeMap = new Map(meterTypes.map((t) => [t.id!, t]));

    return propertyMeters.map((meter) => {
      const mt = typeMap.get(meter.meterTypeId);
      const unit = meter.unitId ? (unitMap.get(meter.unitId) ?? null) : null;
      const locationLabel = unit ? unit.name : "Hauptzähler";
      return {
        meter,
        meterType: mt ?? { id: 0, name: "Unbekannt", unit: "", category: "water" as const },
        unit,
        label: `${mt?.name ?? "Unbekannt"} – ${meter.serialNumber} (${locationLabel})`,
      };
    });
  }, [propertyId]);
}
