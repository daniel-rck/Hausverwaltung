import type { HeatingStatement } from "../../lib/db/schema";
import { formatEuro } from "../../lib/utils/format";

/** Rechnerischer Liter-Verbrauch: Anfangsbestand + Bezüge − Endbestand. */
export function computedConsumptionLiters(s: HeatingStatement): number {
  const purchased = s.purchases.reduce((sum, p) => sum + p.liters, 0);
  return s.openingStock.liters + purchased - s.closingStock.liters;
}

/**
 * Rechnerische "Summe der zu verteilenden Kosten". Basis ist der GEDRUCKTE
 * €-Verbrauch (FIFO-bewertet, nicht ableitbar), plus weitere
 * Heizungsbetriebskosten, minus CO2-Vermieteranteil, plus gesondert verteilte Kosten.
 */
export function computedTotal(s: HeatingStatement): number {
  const other = s.otherHeatingCosts.reduce((sum, p) => sum + p.amount, 0);
  const separate = s.separateCosts.reduce((sum, p) => sum + p.amount, 0);
  return s.consumption.amount + other - s.co2LandlordShare + separate;
}

export type PlausibilityCheck = {
  level: "ok" | "warn";
  message: string;
};

const LITER_TOLERANCE = 0.5;
const EURO_TOLERANCE = 0.01;

function formatLiters(value: number): string {
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} l`;
}

/**
 * Plausibilitätsprüfung der Gesamtrechnung gegen die erfassten
 * Messdienst-Kosten des Jahres (`messdienstCostsTotal` = Summe der
 * `Cost.totalAmount` aller Messdienst-Kostenarten, null = keine erfasst).
 */
export function plausibility(
  s: HeatingStatement,
  messdienstCostsTotal: number | null,
): PlausibilityCheck[] {
  const checks: PlausibilityCheck[] = [];

  const litersDelta = computedConsumptionLiters(s) - s.consumption.liters;
  checks.push(
    Math.abs(litersDelta) <= LITER_TOLERANCE
      ? { level: "ok", message: "Brennstoff-Verbrauch (Liter) passt zur Bestandsführung." }
      : {
          level: "warn",
          message: `Brennstoff-Verbrauch weicht um ${formatLiters(Math.abs(litersDelta))} von der Bestandsführung ab (Anfangsbestand + Bezüge − Endbestand = ${formatLiters(computedConsumptionLiters(s))}).`,
        },
  );

  const totalDelta = computedTotal(s) - s.totalDistributed;
  checks.push(
    Math.abs(totalDelta) <= EURO_TOLERANCE
      ? { level: "ok", message: "Summe der zu verteilenden Kosten passt zu den Einzelpositionen." }
      : {
          level: "warn",
          message: `Summe der zu verteilenden Kosten weicht um ${formatEuro(Math.abs(totalDelta))} von den Einzelpositionen ab (rechnerisch ${formatEuro(computedTotal(s))}).`,
        },
  );

  if (messdienstCostsTotal !== null) {
    const costsDelta = messdienstCostsTotal - s.totalDistributed;
    checks.push(
      Math.abs(costsDelta) <= EURO_TOLERANCE
        ? {
            level: "ok",
            message: "Erfasste Messdienst-Kosten stimmen mit der Gesamtrechnung überein.",
          }
        : {
            level: "warn",
            message: `Erfasste Messdienst-Kosten (${formatEuro(messdienstCostsTotal)}) weichen um ${formatEuro(Math.abs(costsDelta))} von der Gesamtrechnung (${formatEuro(s.totalDistributed)}) ab.`,
          },
    );
  }

  return checks;
}
