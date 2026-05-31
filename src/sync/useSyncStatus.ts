import { useEffect, useState } from "react";
import { type SyncState, syncService } from "./service";

export function useSyncStatus(): SyncState {
  const [state, setState] = useState<SyncState>(() => syncService.getState());

  useEffect(() => {
    return syncService.subscribe(setState);
  }, []);

  return state;
}
