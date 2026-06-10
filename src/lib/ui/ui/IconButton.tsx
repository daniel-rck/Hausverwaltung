import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";

type Variant = "ghost" | "subtle" | "solid";
type Size = "sm" | "md";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Pflicht: aria-label für Screenreader. */
  "aria-label": string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const sizeClasses: Record<Size, string> = {
  sm: "w-7 h-7 text-sm",
  md: "w-9 h-9 text-base",
};

const variantClasses: Record<Variant, string> = {
  ghost:
    "bg-transparent text-fg-muted hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  subtle: "bg-surface-sunken text-fg-muted hover:bg-zinc-200 dark:hover:bg-zinc-700",
  solid: "bg-[--color-accent] text-white hover:bg-[--color-accent-hover]",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { variant = "ghost", size = "md", icon, children, className = "", type = "button", ...rest },
    ref,
  ) => {
    const cls = [
      "inline-flex items-center justify-center rounded-md transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      sizeClasses[size],
      variantClasses[variant],
      className,
    ].join(" ");

    return (
      <button ref={ref} type={type} className={cls} {...rest}>
        <span aria-hidden="true">{icon ?? children}</span>
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
