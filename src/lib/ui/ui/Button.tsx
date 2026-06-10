import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import type { ModulKey } from "./moduleAccent";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "link";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /**
   * Modul-Akzent. Seit dem UI-Overhaul (Linear-Stil) wird der Modul-Akzent für Buttons
   * **nicht** mehr visuell ausgespielt — Primary nutzt den globalen Indigo-Akzent.
   * Die Prop bleibt zur Vermeidung von Breakage bestehender Call-Sites erhalten.
   */
  accent?: ModulKey;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const sizeClasses: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-10 px-4 text-sm gap-2",
};

const baseClasses =
  "inline-flex items-center justify-center font-medium rounded-md transition-colors select-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 " +
  "focus-visible:ring-[--color-accent]/40 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

function variantClasses(variant: Variant): string {
  switch (variant) {
    case "primary":
      return "bg-[--color-accent] text-white hover:bg-[--color-accent-hover]";
    case "secondary":
      return "bg-surface text-fg border border-zinc-300 dark:border-zinc-700 hover:bg-surface-muted/60";
    case "outline":
      return "bg-transparent text-fg border border-zinc-300 dark:border-zinc-700 hover:bg-surface-muted";
    case "ghost":
      return "bg-transparent text-fg-muted hover:bg-surface-sunken";
    case "danger":
      return "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400/40";
    case "link":
      return "bg-transparent text-[--color-accent] dark:text-[--color-accent-dark] underline-offset-4 hover:underline px-0 h-auto";
  }
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = "",
      children,
      type = "button",
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const cls = [
      baseClasses,
      variant === "link" ? "" : sizeClasses[size],
      variantClasses(variant),
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cls}
        {...rest}
      >
        {loading ? <Spinner /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);
Button.displayName = "Button";

function Spinner() {
  return (
    <span
      className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
      aria-hidden="true"
    />
  );
}
