import { type ButtonHTMLAttributes, forwardRef, type HTMLAttributes, type ReactNode } from "react";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ── Card ──────────────────────────────────────────────────────────────
export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Adds a subtle hover-lift for cards that act as a link or button target. */
  interactive?: boolean;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-border bg-surface p-4 shadow-sm",
        interactive &&
          "transition-[transform,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

// ── SectionCard ───────────────────────────────────────────────────────
// A titled section, so a page of them reads as one cohesive set rather than a
// flat stack. The heading is an <h2>: pages are expected to carry their own
// <h1> via PageHeader.
export type SectionCardProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  /** Short right-aligned annotation next to the title (a unit, a count). */
  hint?: ReactNode;
  icon?: ReactNode;
};

export function SectionCard({ title, hint, icon, className, children, ...rest }: SectionCardProps) {
  return (
    <section
      className={cn("rounded-lg border border-border bg-surface p-4 shadow-sm", className)}
      {...rest}
    >
      {title ? (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
            {icon ? (
              <span className="text-accent-600" aria-hidden="true">
                {icon}
              </span>
            ) : null}
            {title}
          </h2>
          {hint ? <span className="text-xs text-fg-muted">{hint}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────
// A selectable pill. `aria-pressed` rather than a role toggle, so a group of
// chips reads as independent toggles to a screen reader. Labels wrap instead
// of truncating — a clipped option is worse than a two-line one.
export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  active?: boolean;
};

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { className, active = false, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium whitespace-normal text-center",
        "transition-[background-color,color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]",
        "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        active
          ? "bg-accent-600 text-fg-on-accent shadow-sm"
          : "bg-surface-muted text-fg-muted hover:bg-surface-sunken hover:text-fg",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

// ── EmptyState ────────────────────────────────────────────────────────
export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center text-center py-12 px-4", className)}>
      {icon ? <div className="mb-4 text-fg-subtle">{icon}</div> : null}
      <h3 className="text-base font-medium">{title}</h3>
      {description ? <p className="mt-1 text-sm text-fg-muted max-w-sm">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────
export type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
};

const SPINNER_SIZE = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-10 w-10" } as const;

export function Spinner({ size = "md", className, label = "Lädt …" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-block animate-spin text-accent-600", SPINNER_SIZE[size], className)}
    >
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path
          d="M22 12a10 10 0 0 0-10-10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────
export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";
export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant };

const BADGE_VARIANT: Record<BadgeVariant, string> = {
  neutral: "bg-surface-sunken text-fg",
  accent: "bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  danger: "bg-danger/15 text-danger",
};

export function Badge({ className, variant = "neutral", children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        BADGE_VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-600 text-white hover:bg-accent-700 focus-visible:ring-accent-500 disabled:bg-accent-300",
  secondary:
    "bg-surface-muted text-fg hover:bg-surface-sunken focus-visible:ring-accent-500 border border-border",
  ghost: "bg-transparent text-fg hover:bg-surface-sunken focus-visible:ring-accent-500",
  danger: "bg-danger text-white hover:opacity-90 focus-visible:ring-danger disabled:opacity-50",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed",
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
