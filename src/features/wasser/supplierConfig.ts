export type SupplierType = "water" | "gas" | "electricity" | "heating";

export const typeConfig: Record<
  SupplierType,
  { label: string; defaultUnit: string; units: string[] }
> = {
  water: { label: "Wasserversorger", defaultUnit: "m³", units: ["m³"] },
  gas: { label: "Gasversorger", defaultUnit: "m³", units: ["m³", "kWh"] },
  electricity: { label: "Stromversorger", defaultUnit: "kWh", units: ["kWh"] },
  heating: { label: "Fernwärme/Heizung", defaultUnit: "kWh", units: ["kWh", "MWh"] },
};
