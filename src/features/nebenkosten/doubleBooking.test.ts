import { describe, expect, it } from "vitest";
import type { Cost, CostType } from "../../lib/db/schema";
import { findDoubleBookingCostTypeIds } from "./doubleBooking";

const costTypes: CostType[] = [
  {
    id: 1,
    name: "Heizung (Messdienst)",
    distribution: "messdienst",
    category: "heating",
    sortOrder: 1,
  },
  { id: 2, name: "Wasser", distribution: "persons", category: "water", sortOrder: 2 },
  { id: 3, name: "Schornsteinfeger", distribution: "units", category: "misc", sortOrder: 3 },
  {
    id: 4,
    name: "Kaltwasser (Messdienst)",
    distribution: "messdienst",
    category: "water",
    sortOrder: 4,
  },
  { id: 5, name: "Grundsteuer", distribution: "area", category: "tax", sortOrder: 5 },
  { id: 6, name: "Sonderumlage Wasser", distribution: "direct", category: "water", sortOrder: 6 },
];

function cost(costTypeId: number, totalAmount: number): Cost {
  return { propertyId: 1, year: 2024, costTypeId, totalAmount };
}

describe("findDoubleBookingCostTypeIds", () => {
  it("warnt bei Wasser (Kategorie) und Schornsteinfeger (Name), wenn Messdienst aktiv ist", () => {
    const ids = findDoubleBookingCostTypeIds(costTypes, [
      cost(1, 2500),
      cost(2, 300),
      cost(3, 120),
      cost(5, 400),
    ]);
    expect(ids).toEqual(new Set([2, 3]));
  });

  it("warnt nicht, wenn keine Messdienst-Kostenart befüllt ist", () => {
    const ids = findDoubleBookingCostTypeIds(costTypes, [cost(1, 0), cost(2, 300), cost(3, 120)]);
    expect(ids.size).toBe(0);
  });

  it("warnt nicht bei Kandidaten ohne Betrag", () => {
    const ids = findDoubleBookingCostTypeIds(costTypes, [cost(1, 2500), cost(2, 0)]);
    expect(ids.size).toBe(0);
  });

  it("nimmt Messdienst- und Direkt-Kostenarten selbst aus", () => {
    const ids = findDoubleBookingCostTypeIds(costTypes, [cost(1, 2500), cost(4, 600), cost(6, 50)]);
    expect(ids.size).toBe(0);
  });
});
