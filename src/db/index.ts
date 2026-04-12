import Dexie, { type EntityTable } from 'dexie';
import type * as S from './schema';

export const db = new Dexie('hausverwaltung') as Dexie & {
  properties: EntityTable<S.Property, 'id'>;
  units: EntityTable<S.Unit, 'id'>;
  tenants: EntityTable<S.Tenant, 'id'>;
  occupancies: EntityTable<S.Occupancy, 'id'>;
  costTypes: EntityTable<S.CostType, 'id'>;
  costs: EntityTable<S.Cost, 'id'>;
  costShares: EntityTable<S.CostShare, 'id'>;
  prepayments: EntityTable<S.Prepayment, 'id'>;
  meterTypes: EntityTable<S.MeterType, 'id'>;
  meters: EntityTable<S.Meter, 'id'>;
  meterReadings: EntityTable<S.MeterReading, 'id'>;
  supplierBills: EntityTable<S.SupplierBill, 'id'>;
  maintenanceItems: EntityTable<S.MaintenanceItem, 'id'>;
  payments: EntityTable<S.Payment, 'id'>;
  handoverProtocols: EntityTable<S.HandoverProtocol, 'id'>;
  settings: EntityTable<S.Setting, 'key'>;
};

db.version(1).stores({
  properties: '++id',
  units: '++id, propertyId',
  tenants: '++id, unitId',
  occupancies: '++id, [unitId+from], tenantId, unitId',
  costTypes: '++id',
  costs: '++id, [year+costTypeId], propertyId',
  costShares: '++id, [costId+occupancyId]',
  prepayments: '++id, [occupancyId+year]',
  meterTypes: '++id',
  meters: '++id, unitId, meterTypeId',
  meterReadings: '++id, [meterId+date]',
  supplierBills: '++id, [year+type], propertyId',
  maintenanceItems: '++id, unitId, date',
  payments: '++id, [occupancyId+month], month',
  handoverProtocols: '++id, occupancyId',
  settings: 'key',
});
