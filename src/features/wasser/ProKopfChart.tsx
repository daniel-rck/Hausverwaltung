import { useMemo } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { Meter, MeterReading, Occupancy, Unit } from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
import { BarChart } from "../../lib/ui/charts/BarChart";
import { Card } from "../../lib/ui/shared/Card";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { Skeleton } from "../../lib/ui/ui";
import { ShowerHead } from "../../lib/ui/ui/icons";
import { monthDiff, waterPerCapitaPerDay } from "../../lib/utils/calc";
import { WATER_AVG_LITERS_PER_PERSON_DAY } from "../../lib/utils/constants";
import { formatNumber } from "../../lib/utils/format";
import { combineConsumption, consumptionForYear } from "./consumption";

interface ProKopfChartProps {
  year: number;
}

interface UnitConsumption {
  unitName: string;
  litersPerPersonPerDay: number;
  persons: number;
  consumptionM3: number;
}

export function ProKopfChart({ year }: ProKopfChartProps) {
  const { activeProperty } = useProperty();
  const propertyId = activeProperty?.id;

  const units = useLiveQuery(
    () =>
      propertyId != null
        ? db.units.where("propertyId").equals(propertyId).toArray()
        : Promise.resolve([] as Unit[]),
    [propertyId],
  );

  const waterMeterTypes = useLiveQuery(
    () => db.meterTypes.filter((mt) => mt.category === "water").toArray(),
    [],
  );

  const allData = useLiveQuery(async () => {
    if (!units || units.length === 0 || !waterMeterTypes || waterMeterTypes.length === 0) {
      return null;
    }

    const waterTypeIds = waterMeterTypes.flatMap((mt) => (mt.id != null ? [mt.id] : []));
    const yearEnd = `${year}-12-31`;
    const yearStartMonth = `${year}-01`;
    const yearEndMonth = `${year}-12`;

    const result: {
      unit: Unit;
      meters: Meter[];
      readings: MeterReading[];
      occupancies: Occupancy[];
    }[] = [];

    for (const unit of units) {
      if (unit.id == null) continue;
      const unitMeters = await db.meters
        .where("unitId")
        .equals(unit.id)
        .filter((m) => waterTypeIds.includes(m.meterTypeId))
        .toArray();

      // Alle Ablesungen bis Jahresende — die Vorjahres-Ablesung ist der Anfangsstand.
      const readings: MeterReading[] = [];
      for (const meter of unitMeters) {
        if (meter.id == null) continue;
        const meterReadings = await db.meterReadings
          .where("[meterId+date]")
          .between([meter.id, ""], [meter.id, yearEnd], true, true)
          .toArray();
        readings.push(...meterReadings);
      }

      const allOccupancies = await db.occupancies.where("unitId").equals(unit.id).toArray();

      const occupancies = allOccupancies.filter(
        (o) => o.from <= yearEndMonth && (o.to === null || o.to >= yearStartMonth),
      );

      result.push({ unit, meters: unitMeters, readings, occupancies });
    }

    return result;
  }, [units, waterMeterTypes, year]);

  const unitConsumptions = useMemo((): UnitConsumption[] => {
    if (!allData) return [];

    const results: UnitConsumption[] = [];

    for (const { unit, meters, readings, occupancies } of allData) {
      // Calculate total water consumption for this unit
      const combined = combineConsumption(
        meters.map((meter) =>
          consumptionForYear(
            readings.filter((r) => r.meterId === meter.id),
            year,
          ),
        ),
      );
      if (!combined || combined.consumption <= 0) continue;
      const totalConsumption = combined.consumption;

      // Calculate weighted average persons across the year
      const yearStartMonth = `${year}-01`;
      const yearEndMonth = `${year}-12`;

      let totalPersonMonths = 0;
      for (const occ of occupancies) {
        const start = occ.from < yearStartMonth ? yearStartMonth : occ.from;
        const end = occ.to === null || occ.to > yearEndMonth ? yearEndMonth : occ.to;
        const months = Math.max(1, monthDiff(start, end) + 1);
        totalPersonMonths += months * occ.persons;
      }

      if (totalPersonMonths <= 0) continue;

      const avgPersons = totalPersonMonths / 12;
      // Tagesmittel aus dem tatsächlichen Ablesezeitraum je Zähler statt fixer 365 Tage.
      const lpd = waterPerCapitaPerDay(combined.perDay, avgPersons, 1);

      results.push({
        unitName: unit.name,
        litersPerPersonPerDay: lpd,
        persons: avgPersons,
        consumptionM3: totalConsumption,
      });
    }

    return results.sort((a, b) => a.unitName.localeCompare(b.unitName));
  }, [allData, year]);

  if (allData === undefined) {
    return (
      <Card title="Pro-Kopf-Verbrauch">
        <Skeleton height="16rem" />
      </Card>
    );
  }

  if (unitConsumptions.length === 0) {
    return (
      <Card title="Pro-Kopf-Verbrauch">
        <EmptyState
          icon={<ShowerHead size={24} strokeWidth={1.75} />}
          title="Keine Verbrauchsdaten"
          description="Es liegen keine ausreichenden Zählerablesungen und Belegungsdaten für die Pro-Kopf-Analyse vor."
        />
      </Card>
    );
  }

  const labels = unitConsumptions.map((u) => u.unitName);
  const dataValues = unitConsumptions.map((u) => Math.round(u.litersPerPersonPerDay * 100) / 100);
  const referenceLineData = unitConsumptions.map(() => WATER_AVG_LITERS_PER_PERSON_DAY);

  return (
    <Card title="Pro-Kopf-Verbrauch">
      <p className="text-sm text-fg-muted mb-4">
        Liter pro Person pro Tag nach Wohneinheit. Bundesdurchschnitt:{" "}
        <span className="font-semibold">{WATER_AVG_LITERS_PER_PERSON_DAY} l/Person/Tag</span>
      </p>

      <div className="mb-4">
        <BarChart
          labels={labels}
          datasets={[
            {
              label: "Verbrauch (l/Person/Tag)",
              data: dataValues,
              color: "#0891b2",
            },
            {
              label: `Durchschnitt (${WATER_AVG_LITERS_PER_PERSON_DAY} l)`,
              data: referenceLineData,
              color: "#d4d4d4",
            },
          ]}
          height={250}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 px-3 text-left font-medium text-fg-muted">Einheit</th>
              <th className="py-2 px-3 text-right font-medium text-fg-muted">Personen</th>
              <th className="py-2 px-3 text-right font-medium text-fg-muted">Verbrauch (m³)</th>
              <th className="py-2 px-3 text-right font-medium text-fg-muted">l/Person/Tag</th>
              <th className="py-2 px-3 text-right font-medium text-fg-muted">Abweichung</th>
            </tr>
          </thead>
          <tbody>
            {unitConsumptions.map((uc) => {
              const deviation =
                ((uc.litersPerPersonPerDay - WATER_AVG_LITERS_PER_PERSON_DAY) /
                  WATER_AVG_LITERS_PER_PERSON_DAY) *
                100;
              const isHigh = deviation > 44;
              return (
                <tr key={uc.unitName} className="border-b border-border">
                  <td className="py-2.5 px-3">{uc.unitName}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatNumber(uc.persons)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {formatNumber(uc.consumptionM3)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono ${
                      isHigh ? "text-danger-fg font-semibold" : ""
                    }`}
                  >
                    {formatNumber(uc.litersPerPersonPerDay)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono ${
                      isHigh
                        ? "text-danger-fg font-semibold"
                        : deviation > 0
                          ? "text-warning-fg"
                          : "text-success-fg"
                    }`}
                  >
                    {deviation >= 0 ? "+" : ""}
                    {formatNumber(deviation)} %
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export type { UnitConsumption };
