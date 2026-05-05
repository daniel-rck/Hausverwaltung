/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { moduleAccent, type ModulKey } from '../ui/moduleAccent';

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
      {a && (
        <span
          aria-hidden="true"
          className={`block w-12 h-1 rounded-full ${a.bg}`}
        />
      )}
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex items-start gap-3">
          {icon && (
            <span
              aria-hidden="true"
              className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg text-xl ${a?.pillBg ?? 'bg-stone-100 dark:bg-stone-800'} ${a?.text ?? 'text-stone-700 dark:text-stone-200'}`}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold text-stone-800 dark:text-stone-100 truncate">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{description}</p>
            )}
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
    <nav aria-label="Brotkrumen" className="text-xs text-stone-500 dark:text-stone-400">
      <ol className="flex items-center gap-1.5 flex-wrap">
        {items.map((item, idx) => {
          const last = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
              {item.to && !last ? (
                <Link to={item.to} className="hover:text-stone-700 dark:hover:text-stone-200">
                  {item.label}
                </Link>
              ) : (
                <span className={last ? 'text-stone-700 dark:text-stone-200 font-medium' : ''} aria-current={last ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
              {!last && <span aria-hidden="true">/</span>}
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
  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: 'Start', to: '/' }];
  let acc = '';
  for (const seg of segments) {
    acc += `/${seg}`;
    items.push({ label: routeLabels[seg] ?? seg, to: acc });
  }
  return items;
}
