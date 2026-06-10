/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "../ui/icons";
import { type ModulKey, moduleAccent } from "../ui/moduleAccent";

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  accent?: ModulKey;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  /** Extra Inhalt unterhalb der Headline (z.B. Tabs). */
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  icon,
  accent,
  actions,
  breadcrumbs,
  children,
}: PageHeaderProps) {
  const a = moduleAccent(accent);

  return (
    <header className="space-y-3">
      {a && <span aria-hidden="true" className={`block w-8 h-0.5 rounded-full ${a.bar}`} />}
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex items-start gap-3">
          {icon && (
            <span
              aria-hidden="true"
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md bg-surface-sunken text-fg"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-fg truncate">
              {title}
            </h1>
            {description && <p className="text-sm text-fg-muted mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Brotkrumen" className="text-[11px] text-fg-muted">
      <ol className="flex items-center gap-1 flex-wrap">
        {items.map((item, idx) => {
          const last = idx === items.length - 1;
          return (
            <li key={item.to ?? item.label} className="flex items-center gap-1">
              {item.to && !last ? (
                <Link to={item.to} className="hover:text-fg transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={last ? "text-fg font-medium" : ""}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last && (
                <ChevronRight
                  size={12}
                  strokeWidth={1.75}
                  className="text-zinc-400"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Simple Auto-Breadcrumb-Komponente, falls man die Routen automatisch ableiten will. */
export function useAutoBreadcrumbs(routeLabels: Record<string, string>): BreadcrumbItem[] {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: "Start", to: "/" }];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    items.push({ label: routeLabels[seg] ?? seg, to: acc });
  }
  return items;
}
