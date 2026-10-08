import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn.ts";

const SURFACE = "rounded-lg border border-border bg-surface p-4 shadow-sm";

export type CardProps = ComponentProps<"div"> & {
  /** Adds a subtle hover-lift for cards that act as a link or button target. */
  interactive?: boolean;
};

export function Card({ className, interactive, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        SURFACE,
        interactive &&
          "transition-[transform,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
      {...rest}
    />
  );
}

// A titled section, so a page of them reads as one cohesive set rather than a
// flat stack. The heading is an <h2>: pages carry their own <h1> via PageHeader.
export type SectionCardProps = Omit<ComponentProps<"section">, "title"> & {
  title?: ReactNode;
  /** Short right-aligned annotation next to the title (a unit, a count). */
  hint?: ReactNode;
  icon?: ReactNode;
};

export function SectionCard({ title, hint, icon, className, children, ...rest }: SectionCardProps) {
  return (
    <section className={cn(SURFACE, className)} {...rest}>
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
