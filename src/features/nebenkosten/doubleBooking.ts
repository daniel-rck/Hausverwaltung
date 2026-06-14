import type { Cost, CostType } from "../../lib/db/schema";

/**
 * Positionen, die ein Messdienstleister (Brunata/Techem/Ista) typischerweise
 * bereits in seiner Abrechnung verteilt: Kalt-/Abwasser sowie Kaminfeger-/
 * Immissionsmessung stecken dort in den Heizungsbetriebskosten.
 */
const CHIMNEY_SWEEP_PATTERN = /schornstein|kaminfeger|kaminkehrer/i;

/**
 * Kostenarten, bei denen eine Doppelbuchung droht: Sie sind befüllt, obwohl im
 * selben Jahr eine Messdienst-Kostenart Beträge hat — deren Abrechnung enthält
 * Wasser- und Schornsteinfeger-Posten meist schon. Rein heuristisch und nicht
 * blockierend; `costs` müssen bereits auf Objekt+Jahr gefiltert sein.
 */
export function findDoubleBookingCostTypeIds(costTypes: CostType[], costs: Cost[]): Set<number> {
  const result = new Set<number>();

  const byId = new Map(costTypes.filter((ct) => ct.id != null).map((ct) => [ct.id as number, ct]));
  const messdienstActive = costs.some(
    (c) => c.totalAmount > 0 && byId.get(c.costTypeId)?.distribution === "messdienst",
  );
  if (!messdienstActive) return result;

  for (const cost of costs) {
    if (cost.totalAmount <= 0) continue;
    const ct = byId.get(cost.costTypeId);
    if (!ct || ct.distribution === "messdienst" || ct.distribution === "direct") continue;
    if (ct.category === "water" || CHIMNEY_SWEEP_PATTERN.test(ct.name)) {
      result.add(ct.id as number);
    }
  }

  return result;
}
