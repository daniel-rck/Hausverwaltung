/**
 * Fremdschlüssel-Karte: welche Felder in welcher Tabelle referenzieren welche Zieltabelle.
 *
 * Wird für die Export/Import-Übersetzung genutzt: beim Export werden numerische IDs
 * durch die stabilen `syncId` des referenzierten Records ersetzt, beim Import zurück.
 *
 * Felder mit `| null` (z.B. meters.unitId) sind hier aufgenommen und werden bei null übersprungen.
 */
export const FK_MAP: Record<string, Record<string, string>> = {
  units: { propertyId: 'properties' },
  tenants: { unitId: 'units' },
  occupancies: { unitId: 'units', tenantId: 'tenants' },
  costs: { propertyId: 'properties', costTypeId: 'costTypes' },
  costShares: { costId: 'costs', occupancyId: 'occupancies' },
  prepayments: { occupancyId: 'occupancies' },
  meters: { unitId: 'units', meterTypeId: 'meterTypes' },
  meterReadings: { meterId: 'meters' },
  supplierBills: { propertyId: 'properties' },
  maintenanceItems: { unitId: 'units' },
  payments: { occupancyId: 'occupancies' },
  handoverProtocols: { occupancyId: 'occupancies' },
  rentChanges: { occupancyId: 'occupancies' },
  depositEvents: { occupancyId: 'occupancies' },
  documents: {
    // entityType bestimmt Zieltabelle dynamisch — wir packen das zur Laufzeit
  },
};

/**
 * Dynamische FK-Auflösung für Records mit Polymorphie (z.B. documents.entityId
 * zeigt je nach entityType auf units, occupancies, properties oder maintenanceItems).
 */
export function resolveDynamicFkTarget(
  tableName: string,
  record: Record<string, unknown>,
): string | null {
  if (tableName === 'documents') {
    const et = record.entityType;
    if (et === 'unit') return 'units';
    if (et === 'occupancy') return 'occupancies';
    if (et === 'property') return 'properties';
    if (et === 'maintenance') return 'maintenanceItems';
  }
  return null;
}
