export interface Property {
  id?: number;
  name: string;
  address: string;
  units: number;
}

export interface Unit {
  id?: number;
  propertyId: number;
  name: string;
  area: number;
  floor?: string;
  notes?: string;
}

export interface Tenant {
  id?: number;
  unitId: number;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface Occupancy {
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

export interface CostType {
  id?: number;
  name: string;
  distribution: DistributionKey;
  category: CostCategory;
  sortOrder: number;
}

export interface Cost {
  id?: number;
  propertyId: number;
  year: number;
  costTypeId: number;
  totalAmount: number;
}

export interface CostShare {
  id?: number;
  costId: number;
  occupancyId: number;
  amount: number;
}

export interface Prepayment {
  id?: number;
  occupancyId: number;
  year: number;
  amount: number;
}

export interface MeterType {
  id?: number;
  name: string;
  unit: string;
  category: 'water' | 'energy';
}

export interface Meter {
  id?: number;
  unitId: number | null;
  meterTypeId: number;
  serialNumber: string;
  installDate?: string;
  calibrationDue?: string;
  notes?: string;
}

export interface MeterReading {
  id?: number;
  meterId: number;
  date: string;
  value: number;
  source: 'self' | 'messdienst' | 'versorger';
}

export interface SupplierBill {
  id?: number;
  propertyId: number;
  year: number;
  type: 'water' | 'gas' | 'electricity';
  supplier: string;
  totalAmount: number;
  totalConsumption: number;
  unit: string;
  billingFrom: string;
  billingTo: string;
  notes?: string;
}

export interface MaintenanceItem {
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

export interface Payment {
  id?: number;
  occupancyId: number;
  month: string;
  amountCold: number;
  amountUtilities: number;
  receivedDate?: string;
  method: 'transfer' | 'cash' | 'debit';
  notes?: string;
}

export interface HandoverProtocol {
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

export interface Setting {
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

export interface RentChange {
  id?: number;
  occupancyId: number;
  effectiveDate: string;
  oldRentCold: number;
  newRentCold: number;
  reason: RentChangeReason;
  notes?: string;
}

export type DepositEventType = 'payment' | 'interest' | 'deduction' | 'refund';

export interface DepositEvent {
  id?: number;
  occupancyId: number;
  date: string;
  type: DepositEventType;
  amount: number;
  description?: string;
}

export interface AppDocument {
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
