import type { ReactNode } from "react";
import { cn } from "./cn.ts";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** The title's element: h2 directly on a page (under PageHeader's h1), h3 inside a SectionCard. */
  titleAs?: "h2" | "h3" | "p";
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  titleAs: Title = "h2",
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center text-center py-12 px-4", className)}>
      {icon ? (
        <div className="mb-4 text-fg-subtle" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <Title className="text-base font-medium">{title}</Title>
      {description ? <p className="mt-1 text-sm text-fg-muted max-w-sm">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
