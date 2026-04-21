import { useSyncStatus } from '../../sync/useSyncStatus';

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'gerade eben';
  if (diff < 3_600_000) return `vor ${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `vor ${Math.floor(diff / 3_600_000)}h`;
  return `vor ${Math.floor(diff / 86_400_000)}d`;
}

export function SyncStatusBadge() {
  const state = useSyncStatus();

  if (state.status === 'disconnected') {
    return null;
  }

  const dotClass =
    state.status === 'idle'
      ? 'bg-green-500'
      : state.status === 'syncing' || state.status === 'connecting'
        ? 'bg-amber-400 animate-pulse'
        : state.status === 'offline'
          ? 'bg-stone-400'
          : 'bg-red-500';

  const label =
    state.status === 'idle'
      ? state.lastSyncedAt
        ? `Sync ${formatRelative(state.lastSyncedAt)}`
        : 'Synchronisiert'
      : state.status === 'syncing'
        ? 'Synchronisiere…'
        : state.status === 'connecting'
          ? 'Verbinde…'
          : state.status === 'offline'
            ? 'Offline'
            : 'Sync-Fehler';

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 px-2 py-1"
      title={state.lastError ?? label}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${dotClass}`} />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}
