/**
 * Mutations-Kanäle des DB-Layers. Schema und Verbindung liegen in `db.ts`
 * (web-base-Naht über `createDBOpener`).
 */

// ---------------------------------------------------------------------------
// Mutations-Benachrichtigung
//
// Zwei getrennte Kanäle (vorher implizit: Dexie-Observability für die UI +
// onLocalWrite für den Sync-Push):
//  - dataChanged:   feuert IMMER bei lokalen Mutationen → treibt useLiveQuery.
//  - localWrite:    unterdrückbar via withoutWriteEvents → triggert Sync-Push.
// ---------------------------------------------------------------------------

const dataChangedListeners = new Set<() => void>();
export function onDataChanged(listener: () => void): () => void {
  dataChangedListeners.add(listener);
  return () => dataChangedListeners.delete(listener);
}
function notifyDataChanged(): void {
  for (const l of dataChangedListeners) {
    try {
      l();
    } catch {
      // Listener-Fehler nicht propagieren
    }
  }
}

const localWriteListeners = new Set<() => void>();
export function onLocalWrite(listener: () => void): () => void {
  localWriteListeners.add(listener);
  return () => localWriteListeners.delete(listener);
}

let suppressWriteEvents = 0;
/**
 * Unterdrückt Sync-Push-Events (localWrite) für die Dauer des Callbacks.
 * UI-Refresh (dataChanged) bleibt aktiv, damit der Bildschirm nach einem
 * Sync-Apply die neuen Daten zeigt.
 */
export async function withoutWriteEvents<T>(fn: () => Promise<T>): Promise<T> {
  suppressWriteEvents++;
  try {
    return await fn();
  } finally {
    suppressWriteEvents--;
  }
}

function notifyLocalWrite(): void {
  if (suppressWriteEvents > 0) return;
  for (const l of localWriteListeners) {
    try {
      l();
    } catch {
      // Listener-Fehler nicht propagieren
    }
  }
}

/** Wird von allen schreibenden Table-Operationen aufgerufen. */
export function fireWrite(): void {
  notifyDataChanged();
  queueMicrotask(notifyLocalWrite);
}
