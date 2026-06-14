import { db } from "./index";
import type { CostType, MeterType } from "./schema";

/**
 * Getrennte Messdienst-Kostenarten (Brunata/Techem/Ista weisen Heizung,
 * Warmwasser und Kaltwasser separat aus). Werden auch in Bestands-DBs
 * nachgeseedet (by-name, siehe seedDatabase) — der historische Sammelposten
 * "Heizung/Warmwasser" bleibt dort unangetastet, weil Alt-Kosten ihn referenzieren.
 */
const messdienstCostTypes: Omit<CostType, "id" | "sortOrder">[] = [
  { name: "Heizung (Messdienst)", distribution: "messdienst", category: "heating" },
  { name: "Warmwasser (Messdienst)", distribution: "messdienst", category: "heating" },
  { name: "Kaltwasser (Messdienst)", distribution: "messdienst", category: "water" },
];

const defaultCostTypes: Omit<CostType, "id">[] = [
  { name: "Grundsteuer", distribution: "area", category: "tax", sortOrder: 1 },
  { name: "Wasser", distribution: "persons", category: "water", sortOrder: 2 },
  { name: "Abwasser", distribution: "persons", category: "water", sortOrder: 3 },
  ...messdienstCostTypes.map((ct, i) => ({ ...ct, sortOrder: 4 + i })),
  { name: "Straßenreinigung", distribution: "area", category: "cleaning", sortOrder: 7 },
  { name: "Müllabfuhr (Bio)", distribution: "persons", category: "cleaning", sortOrder: 8 },
  { name: "Müllabfuhr (Rest)", distribution: "persons", category: "cleaning", sortOrder: 9 },
  { name: "Hausreinigung", distribution: "area", category: "cleaning", sortOrder: 10 },
  { name: "Gartenpflege", distribution: "area", category: "cleaning", sortOrder: 11 },
  { name: "Allgemeinstrom", distribution: "units", category: "misc", sortOrder: 12 },
  { name: "Schornsteinfeger", distribution: "units", category: "misc", sortOrder: 13 },
  { name: "Feuerversicherung", distribution: "area", category: "insurance", sortOrder: 14 },
  { name: "Sturm/Glas/Wasser", distribution: "area", category: "insurance", sortOrder: 15 },
  { name: "Haftpflicht", distribution: "area", category: "insurance", sortOrder: 16 },
  { name: "Hauswart", distribution: "area", category: "misc", sortOrder: 17 },
  { name: "Kabelanschluss", distribution: "units", category: "misc", sortOrder: 18 },
  { name: "Wascheinrichtung", distribution: "units", category: "misc", sortOrder: 19 },
  { name: "Sonstige", distribution: "units", category: "misc", sortOrder: 20 },
];

const defaultMeterTypes: Omit<MeterType, "id">[] = [
  { name: "Kaltwasser", unit: "m³", category: "water" },
  { name: "Warmwasser", unit: "m³", category: "water" },
  { name: "Strom", unit: "kWh", category: "energy" },
  { name: "Gas", unit: "m³", category: "energy" },
  { name: "Heizung", unit: "kWh", category: "energy" },
];

export async function seedDatabase(): Promise<void> {
  const costTypeCount = await db.costTypes.count();
  if (costTypeCount === 0) {
    await db.costTypes.bulkAdd(defaultCostTypes);
  } else {
    // Additiver Seed für Bestands-DBs: fehlende Messdienst-Kostenarten by-name
    // anhängen. Trade-off wie beim count-Guard oben: seeden zwei gepaarte Geräte
    // vor dem ersten Sync, entstehen namensgleiche Duplikate (verschiedene syncIds).
    const existing = await db.costTypes.toArray();
    const existingNames = new Set(existing.map((ct) => ct.name));
    let nextSortOrder = existing.reduce((max, ct) => Math.max(max, ct.sortOrder), 0) + 1;
    const missing = messdienstCostTypes
      .filter((ct) => !existingNames.has(ct.name))
      .map((ct) => ({ ...ct, sortOrder: nextSortOrder++ }));
    if (missing.length > 0) {
      await db.costTypes.bulkAdd(missing);
    }
  }

  const meterTypeCount = await db.meterTypes.count();
  if (meterTypeCount === 0) {
    await db.meterTypes.bulkAdd(defaultMeterTypes);
  }

  const messdienstSetting = await db.settings.get("messdienstName");
  if (!messdienstSetting) {
    await db.settings.put({ key: "messdienstName", value: "Messdienstleister" });
  }

  const landlordSetting = await db.settings.get("landlord");
  if (!landlordSetting) {
    await db.settings.put({
      key: "landlord",
      value: { name: "", address: "", iban: "", taxId: "" },
    });
  }
}
