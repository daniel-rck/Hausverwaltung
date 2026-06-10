import type { ReactNode } from "react";
import { type ModulKey, moduleAccent } from "../ui/moduleAccent";

type Padding = "none" | "xs" | "sm" | "md" | "lg";

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  footer?: ReactNode;
  accent?: ModulKey;
  padding?: Padding;
  interactive?: boolean;
  as?: "div" | "section" | "article";
}

const padMap: Record<Padding, string> = {
  none: "",
  xs: "px-3 py-2",
  sm: "px-3 py-3",
  md: "px-5 py-4",
  lg: "px-6 py-5",
};

export function Card({
  title,
  description,
  children,
  className = "",
  action,
  footer,
  accent,
  padding = "md",
  interactive = false,
  as: Tag = "section",
}: CardProps) {
  const a = moduleAccent(accent);
  const accentBar = a ? (
    <span
      aria-hidden="true"
      className={`absolute left-0 top-0 bottom-0 w-0.5 ${a.bar} rounded-l-lg`}
    />
  ) : null;

  const interactiveCls = interactive
    ? "transition-colors hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer"
    : "";

  return (
    <Tag
      className={`relative bg-surface rounded-lg border border-border ${interactiveCls} ${className}`}
    >
      {accentBar}
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 py-3 border-b border-border">
          <div className="min-w-0">
            {title &&
              (typeof title === "string" ? (
                <h2 className="text-sm font-semibold text-fg tracking-tight truncate">{title}</h2>
              ) : (
                title
              ))}
            {description && <p className="text-xs text-fg-muted mt-0.5">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={padMap[padding]}>{children}</div>
      {footer && (
        <footer className="px-5 py-3 border-t border-border bg-zinc-50/60 dark:bg-zinc-900/40 rounded-b-lg">
          {footer}
        </footer>
      )}
    </Tag>
  );
}
