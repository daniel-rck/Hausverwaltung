import { db, bulkDeleteWithTombstones, deleteWithTombstone } from './index';

/**
 * Kaskadierte Löschungen mit Tombstones, damit Sync-Layer die Löschung
 * auf andere Geräte propagiert. Reihenfolge: zuerst Kinder, dann Eltern,
 * alles in einer logischen Sequenz (einzelne Bulk-Calls führen je
 * eine eigene Transaktion aus — beim Crash kann ein Teil bereits gelöscht sein,
 * der nächste Sync-Pull stellt Konsistenz her).
 */

async function deleteOccupanciesCascade(occIds: number[]): Promise<void> {
  if (occIds.length === 0) return;
  const occIdSet = new Set(occIds);

  const [payments, costShares, prepayments, depositEvents, rentChanges, handovers] =
    await Promise.all([
      db.payments.toArray(),
      db.costShares.toArray(),
      db.prepayments.toArray(),
      db.depositEvents.toArray(),
      db.rentChanges.toArray(),
      db.handoverProtocols.toArray(),
    ]);

  await bulkDeleteWithTombstones(
    'payments',
    payments.filter((p) => occIdSet.has(p.occupancyId)).map((p) => p.id!),
  );
  await bulkDeleteWithTombstones(
    'costShares',
    costShares.filter((s) => occIdSet.has(s.occupancyId)).map((s) => s.id!),
  );
  await bulkDeleteWithTombstones(
    'prepayments',
    prepayments.filter((p) => occIdSet.has(p.occupancyId)).map((p) => p.id!),
  );
  await bulkDeleteWithTombstones(
    'depositEvents',
    depositEvents.filter((e) => occIdSet.has(e.occupancyId)).map((e) => e.id!),
  );
  await bulkDeleteWithTombstones(
    'rentChanges',
    rentChanges.filter((r) => occIdSet.has(r.occupancyId)).map((r) => r.id!),
  );
  const handoverIds = handovers
    .filter((h) => occIdSet.has(h.occupancyId))
    .map((h) => h.id!);
  await deleteDocumentsForEntity('occupancy', occIds);
  await bulkDeleteWithTombstones('handoverProtocols', handoverIds);
  await bulkDeleteWithTombstones('occupancies', occIds);
}

async function deleteDocumentsForEntity(
  entityType: 'unit' | 'occupancy' | 'property' | 'maintenance',
  entityIds: number[],
): Promise<void> {
  if (entityIds.length === 0) return;
  const entitySet = new Set(entityIds);
  // entityType ist nur als Bestandteil des compound-Index [entityType+entityId]
  // indiziert; daher Tabellen-Scan + Filter — Dokumenten-Mengen sind klein.
  const docs = await db.documents.toArray();
  const ids = docs
    .filter((d) => d.entityType === entityType && entitySet.has(d.entityId))
    .map((d) => d.id!)
    .filter((id) => id !== undefined);
  await bulkDeleteWithTombstones('documents', ids);
}

async function deleteMetersCascade(meterIds: number[]): Promise<void> {
  if (meterIds.length === 0) return;
  const set = new Set(meterIds);
  const readings = await db.meterReadings.toArray();
  await bulkDeleteWithTombstones(
    'meterReadings',
    readings.filter((r) => set.has(r.meterId)).map((r) => r.id!),
  );
  await bulkDeleteWithTombstones('meters', meterIds);
}

async function deleteUnitsCascade(unitIds: number[]): Promise<void> {
  if (unitIds.length === 0) return;
  const unitIdSet = new Set(unitIds);

  const [occupancies, tenants, meters, maintenance] = await Promise.all([
    db.occupancies.toArray(),
    db.tenants.toArray(),
    db.meters.toArray(),
    db.maintenanceItems.toArray(),
  ]);

  const occIds = occupancies
    .filter((o) => unitIdSet.has(o.unitId))
    .map((o) => o.id!);
  await deleteOccupanciesCascade(occIds);

  await bulkDeleteWithTombstones(
    'tenants',
    tenants.filter((t) => unitIdSet.has(t.unitId)).map((t) => t.id!),
  );

  const meterIds = meters
    .filter((m) => m.unitId !== null && unitIdSet.has(m.unitId))
    .map((m) => m.id!);
  await deleteMetersCascade(meterIds);

  // Wartungs-Einträge unitId === null (objektweit) werden nicht angefasst
  const maintenanceUnitIds = maintenance
    .filter((m) => m.unitId !== null && unitIdSet.has(m.unitId))
    .map((m) => m.id!);
  await bulkDeleteWithTombstones('maintenanceItems', maintenanceUnitIds);

  await deleteDocumentsForEntity('unit', unitIds);
  await bulkDeleteWithTombstones('units', unitIds);
}

export async function cascadeDeleteUnit(unitId: number): Promise<void> {
  await deleteUnitsCascade([unitId]);
}

export async function cascadeDeleteOccupancy(occupancyId: number): Promise<void> {
  await deleteOccupanciesCascade([occupancyId]);
}

export async function cascadeDeleteMeter(meterId: number): Promise<void> {
  await deleteMetersCascade([meterId]);
}

export async function cascadeDeleteProperty(propertyId: number): Promise<void> {
  const [units, costs, supplierBills] = await Promise.all([
    db.units.where('propertyId').equals(propertyId).toArray(),
    db.costs.where('propertyId').equals(propertyId).toArray(),
    db.supplierBills.where('propertyId').equals(propertyId).toArray(),
  ]);

  const unitIds = units.map((u) => u.id!);
  await deleteUnitsCascade(unitIds);

  if (costs.length > 0) {
    const costIds = new Set(costs.map((c) => c.id!));
    const allShares = await db.costShares.toArray();
    const orphanShareIds = allShares
      .filter((s) => costIds.has(s.costId))
      .map((s) => s.id!);
    await bulkDeleteWithTombstones('costShares', orphanShareIds);
  }

  await bulkDeleteWithTombstones('costs', costs.map((c) => c.id!));
  await bulkDeleteWithTombstones('supplierBills', supplierBills.map((b) => b.id!));

  const settings = await db.settings.toArray();
  const propertyKeys = settings
    .filter((s) => s.key.endsWith(`_${propertyId}`))
    .map((s) => s.key);
  for (const key of propertyKeys) {
    await deleteWithTombstone('settings', key);
  }

  await deleteDocumentsForEntity('property', [propertyId]);
  await deleteWithTombstone('properties', propertyId);
}
