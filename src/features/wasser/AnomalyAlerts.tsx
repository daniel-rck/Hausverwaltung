import { useMemo } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type {
  Meter,
  MeterReading,
  MeterType,
  Occupancy,
  SupplierBill,
  Unit,
} from "../../lib/db/schema";
import { useProperty } from "../../lib/hooks/useProperty";
// Meter, MeterType, MeterReading, Occupancy used in allData query result type
import { Card } from "../../lib/ui/shared/Card";
import { Callout, Skeleton } from "../../lib/ui/ui";
import { monthDiff, waterPerCapitaPerDay } from "../../lib/utils/calc";
import {
  WARM_WATER_RATIO_MAX,
  WARM_WATER_RATIO_MIN,
  WATER_AVG_LITERS_PER_PERSON_DAY,
  WATER_DIFF_THRESHOLD_WARN,
} from "../../lib/utils/constants";
import { formatNumber } from "../../lib/utils/format";
import { combineConsumption, consumptionForYear, type YearConsumption } from "./consumption";

interface AnomalyAlertsProps {
  year: number;
}

interface Anomaly {
  type: "difference" | "per-capita" | "warm-ratio";
  severity: "yellow" | "red";
  title: string;
  description: string;
  unitName?: string;
}

export function AnomalyAlerts({ year }: AnomalyAlertsProps) {
  const { activeProperty } = useProperty();
  const propertyId = activeProperty?.id;

  const supplierBills = useLiveQuery(
    () =>
      propertyId != null
        ? db.supplierBills
            .where("[year+type]")
            .equals([year, "water"])
            .filter((b) => b.propertyId === propertyId)
            .toArray()
        : Promise.resolve([] as SupplierBill[]),
    [year, propertyId],
  );

  const units = useLiveQuery(
    () =>
      propertyId != null
        ? db.units.where("propertyId").equals(propertyId).toArray()
        : Promise.resolve([] as Unit[]),
    [propertyId],
  );

  const allMeterTypes = useLiveQuery(() => db.meterTypes.toArray(), []);

  const allData = useLiveQuery(async () => {
    if (!units || units.length === 0 || !allMeterTypes || allMeterTypes.length === 0) {
      return null;
    }

    const waterTypes = allMeterTypes.filter((mt) => mt.category === "water");
    if (waterTypes.length === 0) return null;

    const waterTypeIds = waterTypes.flatMap((mt) => (mt.id != null ? [mt.id] : []));
    const yearEnd = `${year}-12-31`;
    const yearStartMonth = `${year}-01`;
    const yearEndMonth = `${year}-12`;

    const result: {
      unit: Unit;
      meters: (Meter & { meterType: MeterType })[];
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

      const metersWithTypes = unitMeters.flatMap((m) => {
        const meterType = waterTypes.find((mt) => mt.id === m.meterTypeId);
        return meterType ? [{ ...m, meterType }] : [];
      });

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

      result.push({ unit, meters: metersWithTypes, readings, occupancies });
    }

    return result;
  }, [units, allMeterTypes, year]);

  const anomalies = useMemo((): Anomaly[] => {
    const results: Anomaly[] = [];

    // 1. High difference check
    if (supplierBills && supplierBills.length > 0 && allData) {
      const supplierTotal = supplierBills.reduce((sum, b) => sum + b.totalConsumption, 0);

      const combined = combineConsumption(
        allData.flatMap(({ meters, readings }) =>
          meters.map((meter) =>
            consumptionForYear(
              readings.filter((r) => r.meterId === meter.id),
              year,
            ),
          ),
        ),
      );

      // Ohne auswertbare Zählerstände kein Vergleich — sonst meldet 0 m³ „100 % Differenz".
      if (combined && supplierTotal > 0) {
        const messdienstTotal = combined.consumption;
        const diffPercent = (Math.abs(supplierTotal - messdienstTotal) / supplierTotal) * 100;
        if (diffPercent > WATER_DIFF_THRESHOLD_WARN) {
          results.push({
            type: "difference",
            severity: "red",
            title: "Hohe Differenz Versorger/Messdienstleister",
            description: `Die Differenz zwischen Versorger- und Zählerverbrauch beträgt ${formatNumber(diffPercent)} % und liegt über dem Schwellwert von ${WATER_DIFF_THRESHOLD_WARN} %. Mögliche Ursachen: Leckage, defekte Zähler oder fehlende Ablesungen.`,
          });
        }
      }
    }

    // 2. Per-capita check and warm-ratio check per unit
    if (allData) {
      for (const { unit, meters, readings, occupancies } of allData) {
        // Calculate total water consumption
        let warmTotal = 0;
        let coldTotal = 0;
        const perMeter: (YearConsumption | null)[] = [];

        for (const meter of meters) {
          const yc = consumptionForYear(
            readings.filter((r) => r.meterId === meter.id),
            year,
          );
          perMeter.push(yc);
          if (yc) {
            const consumption = yc.consumption;

            const typeName = meter.meterType.name.toLowerCase();
            if (typeName.includes("warm")) {
              warmTotal += consumption;
            } else {
              coldTotal += consumption;
            }
          }
        }

        const combinedUnit = combineConsumption(perMeter);

        // Per-capita check
        if (combinedUnit && combinedUnit.consumption > 0 && occupancies.length > 0) {
          const yearStartMonth = `${year}-01`;
          const yearEndMonth = `${year}-12`;
          let totalPersonMonths = 0;

          for (const occ of occupancies) {
            const start = occ.from < yearStartMonth ? yearStartMonth : occ.from;
            const end = occ.to === null || occ.to > yearEndMonth ? yearEndMonth : occ.to;
            const months = Math.max(1, monthDiff(start, end) + 1);
            totalPersonMonths += months * occ.persons;
          }

          if (totalPersonMonths > 0) {
            const avgPersons = totalPersonMonths / 12;
            // Tagesmittel aus dem tatsächlichen Ablesezeitraum je Zähler statt fixer 365 Tage.
            const lpd = waterPerCapitaPerDay(combinedUnit.perDay, avgPersons, 1);
            const deviation =
              ((lpd - WATER_AVG_LITERS_PER_PERSON_DAY) / WATER_AVG_LITERS_PER_PERSON_DAY) * 100;

            if (deviation > 44) {
              results.push({
                type: "per-capita",
                severity: "red",
                title: `Hoher Pro-Kopf-Verbrauch: ${unit.name}`,
                description: `Der Verbrauch von ${formatNumber(lpd)} l/Person/Tag liegt ${formatNumber(deviation)} % über dem Bundesdurchschnitt (${WATER_AVG_LITERS_PER_PERSON_DAY} l). Mögliche Ursachen: undichte Armaturen, hoher Gartenbewässerungsbedarf oder fehlerhafte Zähler.`,
                unitName: unit.name,
              });
            }
          }
        }

        // Warm water ratio check
        const totalWaterForRatio = warmTotal + coldTotal;
        if (totalWaterForRatio > 0) {
          const warmPercent = (warmTotal / totalWaterForRatio) * 100;
          if (warmPercent > 50) {
            results.push({
              type: "warm-ratio",
              severity: "red",
              title: `Ungewöhnlicher Warmwasseranteil: ${unit.name}`,
              description: `Der Warmwasseranteil beträgt ${formatNumber(warmPercent)} % und liegt deutlich über dem Normalbereich (${WARM_WATER_RATIO_MIN}–${WARM_WATER_RATIO_MAX} %). Mögliche Ursachen: defekter Kaltwasserzähler, ungewöhnliches Nutzungsverhalten oder Zählervertauschung.`,
              unitName: unit.name,
            });
          }
        }
      }
    }

    return results;
  }, [supplierBills, allData, year]);

  if (supplierBills === undefined || allData === undefined) {
    return (
      <Card title="Hinweise / Anomalien">
        <Skeleton height="4rem" />
      </Card>
    );
  }

  if (anomalies.length === 0) {
    return (
      <Card title="Hinweise / Anomalien">
        <Callout variant="success" title="Alles in Ordnung">
          Es wurden keine Anomalien im Wasserverbrauch festgestellt.
        </Callout>
      </Card>
    );
  }

  return (
    <Card title="Hinweise / Anomalien">
      <div className="space-y-3">
        {anomalies.map((anomaly) => (
          <Callout
            key={`${anomaly.type}-${anomaly.unitName ?? ""}-${anomaly.title}`}
            variant={anomaly.severity === "red" ? "danger" : "warning"}
            title={`${anomaly.severity === "red" ? "Warnung" : "Hinweis"}: ${anomaly.title}`}
          >
            {anomaly.description}
          </Callout>
        ))}
      </div>
    </Card>
  );
}
