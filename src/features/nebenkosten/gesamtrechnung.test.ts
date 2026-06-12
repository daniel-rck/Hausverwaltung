import { describe, expect, it } from "vitest";
import type { HeatingStatement } from "../../lib/db/schema";
import { computedConsumptionLiters, computedTotal, plausibility } from "./gesamtrechnung";

/** Werte aus der Brunata-Gesamtrechnung 2022 (Liegenschaft 154271). */
function statement2022(): HeatingStatement {
  return {
    propertyId: 1,
    year: 2022,
    provider: "BRUNATA-METRONA",
    fuelType: "Heizöl",
    openingStock: { liters: 2420, amount: 1697.99 },
    purchases: [{ date: "2022-09-06", liters: 3960, amount: 6064.86 }],
    closingStock: { liters: 2750, amount: 4211.71 },
    consumption: { liters: 3630, amount: 3551.14 },
    co2LandlordShare: 0,
    otherHeatingCosts: [
      { label: "Verbrauchsabrechnung", amount: 246.27 },
      { label: "Gerätemiete Heizung/Warmwasser", amount: 322.41 },
      { label: "Brennerwartung", amount: 363.79 },
      { label: "Kaminfeger und Immissionsmessung", amount: 76.8 },
    ],
    separateCosts: [
      { label: "Kalt- und Abwasser", amount: 1192.95 },
      { label: "Gerätemiete Kaltwasser", amount: 36.12 },
      { label: "Abrechnung Kaltwasser", amount: 41.89 },
    ],
    totalDistributed: 5831.37,
  };
}

describe("computedConsumptionLiters", () => {
  it("rechnet Anfangsbestand + Bezüge − Endbestand", () => {
    expect(computedConsumptionLiters(statement2022())).toBe(3630);
  });

  it("summiert mehrere Bezüge", () => {
    const s = statement2022();
    s.purchases = [
      { date: "2020-04-27", liters: 2005, amount: 1119.02 },
      { date: "2020-08-17", liters: 2169, amount: 1026.54 },
    ];
    s.openingStock.liters = 2090;
    s.closingStock.liters = 2530;
    expect(computedConsumptionLiters(s)).toBe(3734);
  });
});

describe("computedTotal", () => {
  it("addiert gedruckten Verbrauch, weitere Kosten und gesonderte Verteilung", () => {
    expect(computedTotal(statement2022())).toBeCloseTo(5831.37, 2);
  });

  it("zieht den CO2-Vermieteranteil ab", () => {
    const s = statement2022();
    s.co2LandlordShare = 117.3;
    expect(computedTotal(s)).toBeCloseTo(5831.37 - 117.3, 2);
  });
});

describe("plausibility", () => {
  it("meldet ok, wenn alles zusammenpasst", () => {
    const checks = plausibility(statement2022(), 5831.37);
    expect(checks).toHaveLength(3);
    expect(checks.every((c) => c.level === "ok")).toBe(true);
  });

  it("warnt bei Liter-Differenz in der Bestandsführung", () => {
    const s = statement2022();
    s.consumption.liters = 3500;
    const [liters] = plausibility(s, null);
    expect(liters?.level).toBe("warn");
    expect(liters?.message).toContain("Bestandsführung");
  });

  it("warnt, wenn die Einzelpositionen nicht zur Summe passen", () => {
    const s = statement2022();
    s.totalDistributed = 6000;
    const checks = plausibility(s, null);
    expect(checks[1]?.level).toBe("warn");
    // ohne erfasste Messdienst-Kosten kein dritter Check
    expect(checks).toHaveLength(2);
  });

  it("warnt bei Abweichung zwischen erfassten Kosten und Gesamtrechnung", () => {
    const checks = plausibility(statement2022(), 5000);
    expect(checks[2]?.level).toBe("warn");
    expect(checks[2]?.message).toContain("weichen");
  });
});
