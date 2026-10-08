import type { DBSchema, IDBPDatabase } from "idb";

/**
 * The BroadcastChannel a store's mutations are announced on — the contract
 * between writers (`notifyMutation`) and readers (`useLiveQuery`). `"*"` stands
 * for every store.
 */
export function mutationChannel(store: string): string {
  return `db:${store}`;
}

/**
 * Tell every `useLiveQuery` on `store`, in this tab and in others, to re-run.
 * Call it after the write's transaction completed, not before.
 */
export function notifyMutation(store: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(mutationChannel(store));
  channel.postMessage({ type: "mutation", at: Date.now() });
  channel.close();
}

/**
 * Empty every store in one transaction, then notify all subscribers. A
 * database without stores is left alone: `transaction([])` throws.
 */
export async function clearStores<S extends DBSchema | unknown>(
  db: IDBPDatabase<S>,
): Promise<void> {
  const names = Array.from(db.objectStoreNames);
  if (names.length === 0) return;
  const tx = db.transaction(names, "readwrite");
  await Promise.all([...names.map((name) => tx.objectStore(name).clear()), tx.done]);
  notifyMutation("*");
}
