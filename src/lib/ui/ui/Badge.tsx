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
  neutral: "bg-surface-sunken text-fg border border-border/60",
  success: "bg-success/10 text-success-fg border border-success/30",
  warning: "bg-warning/10 text-warning-fg border border-warning/30",
  danger: "bg-danger/10 text-danger-fg border border-danger/30",
  info: "bg-info/10 text-info-fg border border-info/30",
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
