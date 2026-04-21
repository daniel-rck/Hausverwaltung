/**
 * Sync-Metadaten, die jeder synchronisierbare Record trägt.
 * `syncId` ist die geräteübergreifende Identität, `updatedAt` entscheidet Merge-Konflikte.
 *
 * Die Felder sind statisch optional, weil sie von Dexie-Hooks beim
 * Insert/Update automatisch gesetzt werden — Aufrufer von `table.add(...)`
 * müssen sie nicht manuell liefern. Beim Lesen sind sie für persistente Records
 * immer gesetzt.
 */
export interface SyncFields {
  syncId?: string;
  updatedAt?: number;
}

export interface Property extends SyncFields {
  id?: number;
  name: string;
  address: string;
  units: number;
}

export interface Unit extends SyncFields {
  id?: number;
  propertyId: number;
  name: string;
  area: number;
  floor?: string;
  notes?: string;
}

export interface Tenant extends SyncFields {
  id?: number;
  unitId: number;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface Occupancy extends SyncFields {
  id?: number;
  unitId: number;
  tenantId: number;
  persons: number;
  from: string;
  to: string | null;
  rentCold: number;
  rentUtilities: number;
  deposit: number;
  depositPaid: boolean;
  notes?: string;
}

export type DistributionKey = 'area' | 'persons' | 'units' | 'messdienst' | 'direct';
export type CostCategory = 'water' | 'heating' | 'insurance' | 'tax' | 'cleaning' | 'misc';

export interface CostType extends SyncFields {
  id?: number;
  name: string;
  distribution: DistributionKey;
  category: CostCategory;
  sortOrder: number;
}

export interface Cost extends SyncFields {
  id?: number;
  propertyId: number;
  year: number;
  costTypeId: number;
  totalAmount: number;
}

export interface CostShare extends SyncFields {
  id?: number;
  costId: number;
  occupancyId: number;
  amount: number;
}

export interface Prepayment extends SyncFields {
  id?: number;
  occupancyId: number;
  year: number;
  amount: number;
}

export interface MeterType extends SyncFields {
  id?: number;
  name: string;
  unit: string;
  category: 'water' | 'energy';
}

export interface Meter extends SyncFields {
  id?: number;
  unitId: number | null;
  meterTypeId: number;
  serialNumber: string;
  installDate?: string;
  calibrationDue?: string;
  notes?: string;
}

export interface MeterReading extends SyncFields {
  id?: number;
  meterId: number;
  date: string;
  value: number;
  source: 'self' | 'messdienst' | 'versorger';
}

export interface SupplierBill extends SyncFields {
  id?: number;
  propertyId: number;
  year: number;
  type: 'water' | 'gas' | 'electricity' | 'heating';
  supplier: string;
  totalAmount: number;
  totalConsumption: number;
  unit: string;
  billingFrom: string;
  billingTo: string;
  notes?: string;
}

export interface MaintenanceItem extends SyncFields {
  id?: number;
  unitId: number | null;
  date: string;
  category: 'repair' | 'maintenance' | 'inspection' | 'modernization';
  title: string;
  description?: string;
  contractor?: string;
  cost: number;
  recurring: boolean;
  recurringInterval?: number;
  nextDue?: string;
  notes?: string;
}

export interface Payment extends SyncFields {
  id?: number;
  occupancyId: number;
  month: string;
  amountCold: number;
  amountUtilities: number;
  receivedDate?: string;
  method: 'transfer' | 'cash' | 'debit';
  notes?: string;
}

export interface HandoverProtocol extends SyncFields {
  id?: number;
  occupancyId: number;
  type: 'move-in' | 'move-out';
  date: string;
  rooms: RoomCondition[];
  meterReadings: { meterId: number; value: number }[];
  keys: { type: string; count: number }[];
  notes?: string;
  signatures: {
    landlord?: string;
    tenant?: string;
  };
}

export interface RoomCondition {
  name: string;
  walls: Rating;
  floor: Rating;
  ceiling: Rating;
  windows: Rating;
  doors: Rating;
  notes?: string;
}

export type Rating = 'good' | 'fair' | 'poor';

export interface Setting extends SyncFields {
  key: string;
  value: unknown;
}

export interface LandlordInfo {
  name: string;
  address: string;
  iban?: string;
  taxId?: string;
}

export type RentChangeReason = 'mietspiegel' | 'index' | 'modernization' | 'agreement';

export interface RentChange extends SyncFields {
  id?: number;
  occupancyId: number;
  effectiveDate: string;
  oldRentCold: number;
  newRentCold: number;
  reason: RentChangeReason;
  notes?: string;
}

export type DepositEventType = 'payment' | 'interest' | 'deduction' | 'refund';

export interface DepositEvent extends SyncFields {
  id?: number;
  occupancyId: number;
  date: string;
  type: DepositEventType;
  amount: number;
  description?: string;
}

export interface AppDocument extends SyncFields {
  id?: number;
  entityType: 'unit' | 'occupancy' | 'property' | 'maintenance';
  entityId: number;
  name: string;
  mimeType: string;
  size: number;
  data: string;
  uploadedAt: string;
  notes?: string;
}

export interface FinancingData {
  kaufpreis: number;
  eigenkapital: number;
  kreditbetrag: number;
  zinssatz: number;
  tilgung: number;
  jaehrlicheKreditrate: number;
  nichtUmlagefaehigeKosten: number;
  afaSatz: number;
}

/**
 * Tombstone für gelöschte Records. Wird vom Sync-Layer ausgewertet,
 * damit ein Gerät B erkennen kann, dass A einen Record gelöscht hat.
 */
export interface Tombstone {
  syncId: string;
  tableName: string;
  deletedAt: number;
}
