import { useEffect, useState } from 'react';
import { syncService, type SyncState } from './service';

export function useSyncStatus(): SyncState {
  const [state, setState] = useState<SyncState>(() => syncService.getState());

  useEffect(() => {
    return syncService.subscribe(setState);
  }, []);

  return state;
}
