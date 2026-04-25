import { deflate } from 'pako';
import { db } from './index';

/**
 * Export-Format-Versionen
 *  1.x — vor Multi-Device-Sync (kein syncId/updatedAt)
 *  2.x — DB-Schema v4: jeder Record hat syncId + updatedAt; tombstones-Tabelle
 *
 * Beim Import wird auf das neueste Format migriert (Sync-Felder werden ergänzt),
 * damit alte Backups weiterhin verwendbar sind.
 */
export const EXPORT_FORMAT_VERSION = '2.0';

interface ExportData {
  version: string;
  exported: string;
  app: 'hausverwaltung';
  data: Record<string, unknown[]>;
}

const STORE_NAMES = [
  'properties',
  'units',
  'tenants',
  'occupancies',
  'costTypes',
  'costs',
  'costShares',
  'prepayments',
  'meterTypes',
  'meters',
  'meterReadings',
  'supplierBills',
  'maintenanceItems',
  'payments',
  'handoverProtocols',
  'settings',
  'rentChanges',
  'depositEvents',
  'documents',
] as const;

type StoreName = (typeof STORE_NAMES)[number];

/**
 * Whitelist erlaubter Top-Level-Felder pro Tabelle. Beim Import werden
 * unbekannte Felder verworfen, damit ein manipuliertes JSON keine
 * fremden Properties einschleust.
 */
const ALLOWED_FIELDS: Record<StoreName, readonly string[]> = {
  properties: ['id', 'name', 'address', 'units', 'syncId', 'updatedAt'],
  units: ['id', 'propertyId', 'name', 'area', 'floor', 'notes', 'syncId', 'updatedAt'],
  tenants: ['id', 'unitId', 'name', 'email', 'phone', 'notes', 'syncId', 'updatedAt'],
  occupancies: [
    'id', 'unitId', 'tenantId', 'persons', 'from', 'to',
    'rentCold', 'rentUtilities', 'deposit', 'depositPaid', 'notes',
    'syncId', 'updatedAt',
  ],
  costTypes: ['id', 'name', 'distribution', 'category', 'sortOrder', 'syncId', 'updatedAt'],
  costs: ['id', 'propertyId', 'year', 'costTypeId', 'totalAmount', 'syncId', 'updatedAt'],
  costShares: ['id', 'costId', 'occupancyId', 'amount', 'syncId', 'updatedAt'],
  prepayments: ['id', 'occupancyId', 'year', 'amount', 'syncId', 'updatedAt'],
  meterTypes: ['id', 'name', 'unit', 'category', 'syncId', 'updatedAt'],
  meters: [
    'id', 'unitId', 'meterTypeId', 'serialNumber', 'installDate',
    'calibrationDue', 'notes', 'syncId', 'updatedAt',
  ],
  meterReadings: ['id', 'meterId', 'date', 'value', 'source', 'syncId', 'updatedAt'],
  supplierBills: [
    'id', 'propertyId', 'year', 'type', 'supplier', 'totalAmount',
    'totalConsumption', 'unit', 'billingFrom', 'billingTo', 'notes',
    'syncId', 'updatedAt',
  ],
  maintenanceItems: [
    'id', 'unitId', 'date', 'category', 'title', 'description', 'contractor',
    'cost', 'recurring', 'recurringInterval', 'nextDue', 'notes',
    'syncId', 'updatedAt',
  ],
  payments: [
    'id', 'occupancyId', 'month', 'amountCold', 'amountUtilities',
    'receivedDate', 'method', 'notes', 'syncId', 'updatedAt',
  ],
  handoverProtocols: [
    'id', 'occupancyId', 'type', 'date', 'rooms', 'meterReadings', 'keys',
    'notes', 'signatures', 'syncId', 'updatedAt',
  ],
  settings: ['key', 'value', 'syncId', 'updatedAt'],
  rentChanges: [
    'id', 'occupancyId', 'effectiveDate', 'oldRentCold', 'newRentCold',
    'reason', 'notes', 'syncId', 'updatedAt',
  ],
  depositEvents: ['id', 'occupancyId', 'date', 'type', 'amount', 'description', 'syncId', 'updatedAt'],
  documents: [
    'id', 'entityType', 'entityId', 'name', 'mimeType', 'size', 'data',
    'uploadedAt', 'notes', 'syncId', 'updatedAt',
  ],
};

function sanitizeRecord(store: StoreName, raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const allowed = ALLOWED_FIELDS[store];
  const cleaned: Record<string, unknown> = {};
  for (const key of allowed) {
    const v = (raw as Record<string, unknown>)[key];
    if (v !== undefined) cleaned[key] = v;
  }
  return cleaned;
}

export async function exportDatabase(): Promise<string> {
  const data: Record<string, unknown[]> = {};

  for (const store of STORE_NAMES) {
    data[store] = await (db[store] as ReturnType<typeof db.table>).toArray();
  }

  const exportData: ExportData = {
    version: EXPORT_FORMAT_VERSION,
    exported: new Date().toISOString(),
    app: 'hausverwaltung',
    data,
  };

  return JSON.stringify(exportData, null, 2);
}

export async function importDatabase(jsonString: string): Promise<void> {
  let parsed: ExportData;
  try {
    parsed = JSON.parse(jsonString) as ExportData;
  } catch {
    throw new Error('Ungültiges Dateiformat: kein gültiges JSON.');
  }

  if (parsed.app !== 'hausverwaltung') {
    throw new Error('Ungültige Datei: Kein Hausverwaltung-Export.');
  }

  if (!parsed.version || !parsed.data || typeof parsed.data !== 'object') {
    throw new Error('Ungültiges Dateiformat.');
  }

  const major = Number.parseInt(parsed.version.split('.')[0] ?? '0', 10);
  const isLegacy = major < 2;
  const now = Date.now();

  await db.transaction('rw', db.tables, async () => {
    for (const store of STORE_NAMES) {
      const table = db[store] as ReturnType<typeof db.table>;
      await table.clear();

      const records = parsed.data[store];
      if (!Array.isArray(records) || records.length === 0) continue;

      const sanitized = records
        .map((r) => sanitizeRecord(store, r))
        .filter((r): r is Record<string, unknown> => r !== null)
        .map((r) => {
          // Legacy-Migration: Sync-Felder ergänzen
          if (isLegacy) {
            if (!r.syncId) r.syncId = crypto.randomUUID();
            if (typeof r.updatedAt !== 'number') r.updatedAt = now;
          }
          return r;
        });

      if (sanitized.length > 0) {
        await table.bulkPut(sanitized);
      }
    }

    // Beim Import alter Backups auch sämtliche Tombstones löschen, sonst
    // werden gerade importierte Records beim nächsten Sync wieder entfernt.
    await db.tombstones.clear();
  });
}

export function downloadJson(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const MAX_URL_EXPORT_BYTES = 512 * 1024; // 512 KB base64

/**
 * Compress export data into a base64url string for embedding in a URL.
 * Flow: JSON string → deflate → base64url. Wirft, wenn die komprimierte
 * Größe das URL-Limit übersteigt — Nutzer soll dann JSON-Datei verwenden.
 */
export async function exportAsUrl(): Promise<string> {
  const json = await exportDatabase();
  const compressed = deflate(json);

  // Base64-Konvertierung: Spread-Operator scheitert bei sehr großen Arrays
  // ("call stack exceeded"); daher chunked.
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < compressed.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...compressed.subarray(i, i + chunkSize),
    );
  }
  const base64 = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  if (base64.length > MAX_URL_EXPORT_BYTES) {
    throw new Error(
      `Datenmenge zu groß für URL-Export (${Math.round(base64.length / 1024)} KB). Bitte JSON-Datei verwenden.`,
    );
  }

  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#/import/${base64}`;
}
