import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger" | "info";
export type BadgeProps = ComponentProps<"span"> & { variant?: BadgeVariant };

// Text on a semantic tint uses the matching `-fg` token: the fill colours
// themselves are too light to read as text on their own 15% tint.
const VARIANT: Record<BadgeVariant, string> = {
  neutral: "bg-surface-sunken text-fg",
  accent: "bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200",
  success: "bg-success/15 text-success-fg",
  warning: "bg-warning/20 text-warning-fg",
  danger: "bg-danger/15 text-danger-fg",
  info: "bg-info/15 text-info-fg",
};

export function Badge({ className, variant = "neutral", ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
  );
}
