import type { ReactNode } from 'react';
import { moduleAccent, type ModulKey } from './moduleAccent';

interface KpiTileProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  accent?: ModulKey;
  delta?: { value: string; trend: 'up' | 'down' | 'flat' };
  loading?: boolean;
}

export function KpiTile({ label, value, hint, accent, delta, loading = false }: KpiTileProps) {
  const a = moduleAccent(accent);
  const accentText = a?.text ?? 'text-stone-700 dark:text-stone-200';

  return (
    <div className="rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-3 sm:p-4 flex flex-col gap-1">
      <p className="text-xs text-stone-500 dark:text-stone-400">{label}</p>
      {loading ? (
        <div className="h-7 w-20 rounded bg-stone-200 dark:bg-stone-700 animate-pulse" />
      ) : (
        <p className={`text-xl font-semibold font-mono font-tabular ${accentText}`}>{value}</p>
      )}
      <div className="flex items-center justify-between gap-2 min-h-[1rem]">
        {hint && <p className="text-xs text-stone-500 dark:text-stone-400">{hint}</p>}
        {delta && (
          <span
            className={`text-xs font-medium ${
              delta.trend === 'up'
                ? 'text-green-600 dark:text-green-400'
                : delta.trend === 'down'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            {delta.trend === 'up' ? '↑' : delta.trend === 'down' ? '↓' : '→'} {delta.value}
          </span>
        )}
      </div>
    </div>
  );
}
