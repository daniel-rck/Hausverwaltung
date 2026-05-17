import { useDeferredValue, useId, useMemo, useState, type ReactNode } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from '../ui/icons';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  /** Optional: alternativer Mobile-Label (sonst wird `header` verwendet). */
  mobileLabel?: string;
  /** Bei `true` wird die Zelle auf Mobile zur Hauptzeile (oben fett). */
  primary?: boolean;
  /** Bei `true` wird die Zelle auf Mobile als Sub-Aktion in einer Action-Reihe gerendert (statt mit Label). */
  action?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyFn: (row: T) => string | number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  /** Aktiviert die Suchleiste. Wenn `true` wird `searchableFields` verwendet. */
  searchable?: boolean;
  searchableFields?: (keyof T)[];
  searchFn?: (row: T, query: string) => boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  density?: 'compact' | 'comfortable';
  /** Optionaler Toolbar-Slot, wird neben der Search-Bar gerendert. */
  toolbar?: ReactNode;
  /** Sticky Toolbar oberhalb der Tabelle (top-14 unter Header). */
  stickyToolbar?: boolean;
  /** Zebra-Stripes für die Tabelle. */
  zebra?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyFn,
  emptyMessage = 'Keine Daten vorhanden.',
  onRowClick,
  searchable = false,
  searchableFields,
  searchFn,
  searchPlaceholder = 'Suchen…',
  pageSize,
  density = 'compact',
  toolbar,
  stickyToolbar = false,
  zebra = false,
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const reactId = useId();
  const searchId = `${reactId}-search`;

  const filtered = useMemo(() => {
    if (!searchable || !deferredQuery.trim()) return data;
    const q = deferredQuery.trim().toLowerCase();
    if (searchFn) return data.filter((row) => searchFn(row, q));
    if (searchableFields) {
      return data.filter((row) =>
        searchableFields.some((f) => String(row[f] ?? '').toLowerCase().includes(q)),
      );
    }
    return data;
  }, [data, deferredQuery, searchable, searchableFields, searchFn]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const usePagination = pageSize && sorted.length > pageSize;
  const totalPages = usePagination ? Math.ceil(sorted.length / pageSize!) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const visible = usePagination
    ? sorted.slice(safePage * pageSize!, (safePage + 1) * pageSize!)
    : sorted;

  const toggleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortValue) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const padY = density === 'compact' ? 'py-1.5' : 'py-2.5';

  const alignClass = (a: Column<T>['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  const toolbarCls = stickyToolbar
    ? 'sticky top-14 z-10 -mx-3 md:-mx-5 px-3 md:px-5 py-2 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200/60 dark:border-zinc-800/60'
    : '';

  return (
    <div className={`space-y-3 ${className}`}>
      {(searchable || toolbar) && (
        <div className={toolbarCls}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {searchable ? (
              <div className="relative flex-1 min-w-0 max-w-sm">
                <Search
                  size={14}
                  strokeWidth={1.75}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  aria-hidden="true"
                />
                <label className="sr-only" htmlFor={searchId}>
                  Suchen
                </label>
                <input
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm pl-8 pr-3 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]/40 focus-visible:border-[--color-accent]"
                />
              </div>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2 shrink-0">
              {toolbar}
              {searchable && data.length > 0 && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {sorted.length} / {data.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4 text-center">{emptyMessage}</p>
      ) : (
        <>
          {/* Desktop: echte Tabelle */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`${padY} px-3 text-[11px] uppercase tracking-wide font-medium text-zinc-500 dark:text-zinc-400 ${alignClass(col.align)} ${
                        col.sortValue
                          ? 'cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100'
                          : ''
                      }`}
                      aria-sort={
                        col.sortValue
                          ? sortKey === col.key
                            ? sortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {col.sortValue && sortKey === col.key && (
                          sortDir === 'asc' ? (
                            <ChevronUp size={12} strokeWidth={2} aria-hidden="true" />
                          ) : (
                            <ChevronDown size={12} strokeWidth={2} aria-hidden="true" />
                          )
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, idx) => (
                  <tr
                    key={keyFn(row)}
                    onClick={() => onRowClick?.(row)}
                    className={`border-b border-zinc-100 dark:border-zinc-800/60 ${
                      zebra && idx % 2 === 1 ? 'bg-zinc-50/50 dark:bg-zinc-900/30' : ''
                    } ${
                      onRowClick ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40' : ''
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`${padY} px-3 ${alignClass(col.align)} text-zinc-700 dark:text-zinc-200`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: Card-Liste */}
          <ul className="sm:hidden space-y-1.5">
            {visible.map((row) => {
              const primaryCol = columns.find((c) => c.primary);
              const detailCols = columns.filter((c) => !c.primary && !c.action);
              const actionCols = columns.filter((c) => c.action);
              return (
                <li
                  key={keyFn(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 ${
                    onRowClick ? 'cursor-pointer active:bg-zinc-50 dark:active:bg-zinc-800/60' : ''
                  }`}
                >
                  {primaryCol && (
                    <div className="font-medium text-zinc-900 dark:text-zinc-50 mb-1 tracking-tight">
                      {primaryCol.render(row)}
                    </div>
                  )}
                  <dl className="space-y-1 text-xs">
                    {detailCols.map((col) => (
                      <div key={col.key} className="flex justify-between gap-2">
                        <dt className="text-zinc-500 dark:text-zinc-400">
                          {col.mobileLabel ?? col.header}
                        </dt>
                        <dd className="text-zinc-700 dark:text-zinc-200 text-right">
                          {col.render(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {actionCols.length > 0 && (
                    <div
                      className="flex flex-wrap items-center gap-1 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actionCols.map((col) => (
                        <span key={col.key}>{col.render(row)}</span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {usePagination && (
            <nav
              aria-label="Seitennavigation"
              className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1"
            >
              <span>
                Seite {safePage + 1} von {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(0, safePage - 1))}
                  disabled={safePage === 0}
                  className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  <ChevronLeft size={12} strokeWidth={2} aria-hidden="true" />
                  Zurück
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  Weiter
                  <ChevronRight size={12} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
