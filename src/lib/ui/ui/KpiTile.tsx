import type { ReactNode } from "react";
import { Minus, TrendingDown, TrendingUp } from "./icons";
import { type ModulKey, moduleAccent } from "./moduleAccent";

interface KpiTileProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /**
   * Modul-Akzent. Seit dem UI-Overhaul (Linear-Stil) wird der Akzent nur noch als
   * 2px-Top-Border-Indikator gerendert — der Wert bleibt immer neutral.
   */
  accent?: ModulKey;
  delta?: { value: string; trend: "up" | "down" | "flat" };
  loading?: boolean;
}

export function KpiTile({ label, value, hint, accent, delta, loading = false }: KpiTileProps) {
  const a = moduleAccent(accent);
  const TrendIcon =
    delta?.trend === "up" ? TrendingUp : delta?.trend === "down" ? TrendingDown : Minus;
  const trendColor =
    delta?.trend === "up"
      ? "text-green-600 dark:text-green-400"
      : delta?.trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-fg-muted";

  return (
    <div className="relative rounded-lg bg-surface border border-border p-3 sm:p-4 flex flex-col gap-1 overflow-hidden">
      {a && <span aria-hidden="true" className={`absolute left-0 right-0 top-0 h-0.5 ${a.bar}`} />}
      <p className="text-[11px] uppercase tracking-wide text-fg-muted font-medium">{label}</p>
      {loading ? (
        <div className="h-7 w-20 rounded bg-surface-sunken animate-pulse" />
      ) : (
        <p className="text-2xl font-semibold font-tabular text-fg tracking-tight">{value}</p>
      )}
      <div className="flex items-center justify-between gap-2 min-h-[1rem]">
        {hint && <p className="text-xs text-fg-muted">{hint}</p>}
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
