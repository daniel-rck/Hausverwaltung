import { useEffect, useRef, useState } from "react";
import { onDataChanged } from "./idb";

/**
 * Reaktive IndexedDB-Query – API-kompatibel zum bisherigen
 * `useLiveQuery` aus `dexie-react-hooks`.
 *
 * Führt den Querier initial und bei jeder lokalen Mutation (dataChanged) sowie
 * bei Änderung der `deps` erneut aus. Granularität ist bewusst grob (jede
 * Mutation re-evaluiert alle Live-Queries) – für die Datenmengen dieser App
 * unkritisch und deutlich einfacher als feingranulares Table-Tracking.
 */
export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps: unknown[] = [],
): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const querierRef = useRef(querier);
  querierRef.current = querier;

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps werden vom Aufrufer geliefert (wie bei dexie-react-hooks)
  useEffect(() => {
    let active = true;

    const run = () => {
      Promise.resolve(querierRef.current())
        .then((result) => {
          if (active) setValue(result);
        })
        .catch((err) => {
          if (active) console.error("useLiveQuery failed:", err);
        });
    };

    run();
    const unsubscribe = onDataChanged(run);
    return () => {
      active = false;
      unsubscribe();
    };
  }, deps);

  return value;
}
