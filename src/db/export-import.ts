import { deflate } from 'pako';
import { db } from './index';

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

export async function exportDatabase(): Promise<string> {
  const data: Record<string, unknown[]> = {};

  for (const store of STORE_NAMES) {
    data[store] = await (db[store] as ReturnType<typeof db.table>).toArray();
  }

  const exportData: ExportData = {
    version: '1.0',
    exported: new Date().toISOString(),
    app: 'hausverwaltung',
    data,
  };

  return JSON.stringify(exportData, null, 2);
}

export async function importDatabase(jsonString: string): Promise<void> {
  const parsed: ExportData = JSON.parse(jsonString);

  if (parsed.app !== 'hausverwaltung') {
    throw new Error('Ungültige Datei: Kein Hausverwaltung-Export.');
  }

  if (!parsed.version || !parsed.data) {
    throw new Error('Ungültiges Dateiformat.');
  }

  await db.transaction('rw', db.tables, async () => {
    for (const store of STORE_NAMES) {
      const table = db[store] as ReturnType<typeof db.table>;
      await table.clear();

      const records = parsed.data[store];
      if (Array.isArray(records) && records.length > 0) {
        await table.bulkAdd(records);
      }
    }
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

/**
 * Compress export data into a base64url string for embedding in a URL.
 * Flow: JSON string → deflate → base64url
 */
export async function exportAsUrl(): Promise<string> {
  const json = await exportDatabase();
  const compressed = deflate(json);
  // Convert to base64url (URL-safe base64)
  const base64 = btoa(String.fromCharCode(...compressed))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#/import/${base64}`;
}
