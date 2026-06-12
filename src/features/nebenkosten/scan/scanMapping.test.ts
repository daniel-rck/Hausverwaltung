import { describe, expect, it } from "vitest";
import {
  buildCostDrafts,
  matchOccupancy,
  parseScanResponse,
  prefillPositionMapping,
  type ScannedAbrechnung,
} from "./scanMapping";

describe("parseScanResponse", () => {
  it("parses a valid payload", () => {
    const result = parseScanResponse({
      provider: "BRUNATA METRONA",
      billingFrom: "2015-01-01",
      billingTo: "2015-12-31",
      year: 2015,
      units: [
        {
          unitLabel: "0001 KG01",
          tenantName: "LIEDKE CHRISTIAN u. SONJA",
          positions: [
            { label: "Heizung Grundkosten", amount: 224.58, consumption: 75, unit: "m2" },
            { label: "Abrechnung Kaltwasser", amount: 12.87 },
          ],
          total: 1355.53,
        },
      ],
      totals: [{ label: "Heizung Grundkosten", amount: 814.47, consumption: 272, unit: "m2" }],
    });

    expect(result.provider).toBe("BRUNATA METRONA");
    expect(result.year).toBe(2015);
    expect(result.units).toHaveLength(1);
    expect(result.units[0]?.positions).toHaveLength(2);
    expect(result.totals[0]?.amount).toBe(814.47);
  });

  it("survives garbage payloads and drops empty units/positions", () => {
    expect(parseScanResponse(null).units).toEqual([]);
    expect(parseScanResponse("nonsense").units).toEqual([]);
    const result = parseScanResponse({
      units: [
        { unitLabel: "x", tenantName: "y", positions: [{ amount: 5 }], total: 0 },
        { unitLabel: "z", tenantName: "w", positions: [{ label: "Heizung", amount: 5 }], total: 5 },
      ],
    });
    expect(result.units).toHaveLength(1);
    expect(result.units[0]?.unitLabel).toBe("z");
  });

  it("derives the year from billingTo when missing", () => {
    const result = parseScanResponse({ billingTo: "2015-12-31", units: [] });
    expect(result.year).toBe(2015);
  });
});

describe("matchOccupancy", () => {
  const candidates = [
    { occupancyId: 1, tenantName: "Christian Liedke", unitName: "KG01" },
    { occupancyId: 2, tenantName: "Gisbert Dingler", unitName: "OG01" },
  ];

  it("matches by tenant-name substring, case-insensitive", () => {
    const match = matchOccupancy({ unitLabel: "0003 OG01", tenantName: "DINGLER GISBERT" }, [
      { occupancyId: 2, tenantName: "Dingler", unitName: "OG01" },
    ]);
    expect(match?.occupancyId).toBe(2);
  });

  it("falls back to the unit name", () => {
    const match = matchOccupancy({ unitLabel: "0002 og01", tenantName: "Unbekannt" }, candidates);
    expect(match?.occupancyId).toBe(2);
  });

  it("returns null without a match", () => {
    expect(matchOccupancy({ unitLabel: "0009 DG", tenantName: "Meier" }, candidates)).toBeNull();
  });
});

describe("prefillPositionMapping", () => {
  const brunataLabels = [
    "Heizung Grundkosten",
    "Heizung Verbrauchskosten",
    "Warmwasser Grundkosten",
    "Warmwasser Verbrauchskosten",
    "Kalt- und Abwasser",
    "Gerätemiete Kaltwasser",
    "Abrechnung Kaltwasser",
    "Kosten bei Nutzerwechsel",
  ];

  it("mappt Brunata-Positionen auf die getrennten Messdienst-Kostenarten", () => {
    const mapping = prefillPositionMapping(brunataLabels, [
      { id: 1, name: "Heizung (Messdienst)" },
      { id: 2, name: "Warmwasser (Messdienst)" },
      { id: 3, name: "Kaltwasser (Messdienst)" },
    ]);

    expect(mapping.get("Heizung Grundkosten")).toBe(1);
    expect(mapping.get("Heizung Verbrauchskosten")).toBe(1);
    expect(mapping.get("Warmwasser Grundkosten")).toBe(2);
    expect(mapping.get("Warmwasser Verbrauchskosten")).toBe(2);
    expect(mapping.get("Kalt- und Abwasser")).toBe(3);
    expect(mapping.get("Gerätemiete Kaltwasser")).toBe(3);
    expect(mapping.get("Abrechnung Kaltwasser")).toBe(3);
    // kein Keyword → bleibt für die manuelle Zuordnung offen
    expect(mapping.has("Kosten bei Nutzerwechsel")).toBe(false);
  });

  it("bevorzugt die spezifische Kostenart vor dem Sammelposten", () => {
    const mapping = prefillPositionMapping(
      ["Warmwasser Grundkosten", "Heizung Grundkosten"],
      [
        { id: 4, name: "Heizung/Warmwasser" },
        { id: 2, name: "Warmwasser (Messdienst)" },
        { id: 1, name: "Heizung (Messdienst)" },
      ],
    );
    expect(mapping.get("Warmwasser Grundkosten")).toBe(2);
    expect(mapping.get("Heizung Grundkosten")).toBe(1);
  });

  it("fällt auf den Sammelposten zurück, wenn nichts Spezifischeres existiert", () => {
    const mapping = prefillPositionMapping(
      ["Warmwasser Grundkosten"],
      [{ id: 4, name: "Heizung/Warmwasser" }],
    );
    expect(mapping.get("Warmwasser Grundkosten")).toBe(4);
  });
});

describe("buildCostDrafts", () => {
  const abrechnung: ScannedAbrechnung = {
    provider: "BRUNATA",
    billingFrom: "2015-01-01",
    billingTo: "2015-12-31",
    year: 2015,
    units: [
      {
        unitLabel: "0001",
        tenantName: "A",
        positions: [
          { label: "Heizung Grundkosten", amount: 100 },
          { label: "Heizung Verbrauchskosten", amount: 200 },
          { label: "Kaltwasser", amount: 50 },
        ],
        total: 350,
      },
      {
        unitLabel: "0002",
        tenantName: "B",
        positions: [{ label: "Heizung Grundkosten", amount: 80 }],
        total: 80,
      },
    ],
    totals: [
      { label: "Heizung Grundkosten", amount: 180 },
      { label: "Heizung Verbrauchskosten", amount: 200 },
    ],
  };

  const positionMapping = new Map<string, number | "ignore">([
    ["Heizung Grundkosten", 10],
    ["Heizung Verbrauchskosten", 10],
    ["Kaltwasser", "ignore"],
  ]);

  it("sums positions per cost type and occupancy, skipping ignored ones", () => {
    const drafts = buildCostDrafts({
      abrechnung,
      positionMapping,
      unitMapping: new Map([
        [0, 101],
        [1, 102],
      ]),
    });

    expect(drafts).toHaveLength(1);
    const heizung = drafts[0];
    expect(heizung?.costTypeId).toBe(10);
    expect(heizung?.shares).toEqual([
      { occupancyId: 101, amount: 300 },
      { occupancyId: 102, amount: 80 },
    ]);
    // Total from the document's "Summe aller Nutzer" row.
    expect(heizung?.totalAmount).toBe(380);
  });

  it("skips units without an occupancy mapping and falls back to the share sum", () => {
    const drafts = buildCostDrafts({
      abrechnung: { ...abrechnung, totals: [] },
      positionMapping,
      unitMapping: new Map([[0, 101]]),
    });

    expect(drafts[0]?.shares).toEqual([{ occupancyId: 101, amount: 300 }]);
    expect(drafts[0]?.totalAmount).toBe(300);
  });

  it("returns no draft when nothing is mapped", () => {
    const drafts = buildCostDrafts({
      abrechnung,
      positionMapping: new Map(),
      unitMapping: new Map([[0, 101]]),
    });
    expect(drafts).toEqual([]);
  });
});
