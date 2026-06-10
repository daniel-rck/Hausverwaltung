import type { ReactNode } from "react";
import type { ModulKey } from "./moduleAccent";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /**
   * Modul-Akzent. Seit dem UI-Overhaul (Linear-Stil) wird der Akzent für Badges
   * nicht mehr visuell ausgespielt — die `variant`-Prop steuert die Farbe.
   */
  accent?: ModulKey;
  className?: string;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-surface-sunken text-fg border border-zinc-200/60 dark:border-zinc-700/60",
  success:
    "bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200/60 dark:border-green-900/60",
  warning:
    "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/60",
  danger:
    "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-900/60",
  info: "bg-[--color-accent-soft] dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/60",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2 py-0.5",
};

export function Badge({ variant = "neutral", size = "md", className = "", children }: BadgeProps) {
  const cls = [
    "inline-flex items-center gap-1 rounded-full font-medium",
    sizeClasses[size],
    variantClasses[variant],
    className,
  ].join(" ");
  return <span className={cls}>{children}</span>;
}
