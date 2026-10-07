import type { ComponentProps } from "react";
import { cn, FOCUS_RING } from "./cn.ts";

// A selectable pill. `aria-pressed` rather than a role toggle, so a group of
// chips reads as independent toggles to a screen reader. Labels wrap instead
// of truncating — a clipped option is worse than a two-line one.
export type ChipProps = Omit<ComponentProps<"button">, "type"> & {
  active?: boolean;
};

export function Chip({ className, active = false, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium whitespace-normal text-center",
        "transition-[background-color,color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]",
        "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
        FOCUS_RING,
        "focus-visible:outline-accent-500",
        active
          ? "bg-accent-600 text-fg-on-accent shadow-sm"
          : "bg-surface-muted text-fg-muted not-disabled:hover:bg-surface-sunken not-disabled:hover:text-fg",
        className,
      )}
      {...rest}
    />
  );
}
