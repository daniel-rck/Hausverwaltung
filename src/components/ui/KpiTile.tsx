import type { ReactNode } from 'react';
import { moduleAccent, type ModulKey } from './moduleAccent';
import { TrendingUp, TrendingDown, Minus } from './icons';

interface KpiTileProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /**
   * Modul-Akzent. Seit dem UI-Overhaul (Linear-Stil) wird der Akzent nur noch als
   * 2px-Top-Border-Indikator gerendert — der Wert bleibt immer neutral.
   */
  accent?: ModulKey;
  delta?: { value: string; trend: 'up' | 'down' | 'flat' };
  loading?: boolean;
}

export function KpiTile({ label, value, hint, accent, delta, loading = false }: KpiTileProps) {
  const a = moduleAccent(accent);
  const TrendIcon = delta?.trend === 'up' ? TrendingUp : delta?.trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    delta?.trend === 'up'
      ? 'text-green-600 dark:text-green-400'
      : delta?.trend === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-zinc-500 dark:text-zinc-400';

  return (
    <div className="relative rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 flex flex-col gap-1 overflow-hidden">
      {a && (
        <span
          aria-hidden="true"
          className={`absolute left-0 right-0 top-0 h-0.5 ${a.bar}`}
        />
      )}
      <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 font-medium">
        {label}
      </p>
      {loading ? (
        <div className="h-7 w-20 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
      ) : (
        <p className="text-2xl font-semibold font-tabular text-zinc-900 dark:text-zinc-50 tracking-tight">
          {value}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 min-h-[1rem]">
        {hint && <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
        {delta && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={12} strokeWidth={2} aria-hidden="true" />
            {delta.value}
          </span>
        )}
      </div>
    </div>
  );
}
