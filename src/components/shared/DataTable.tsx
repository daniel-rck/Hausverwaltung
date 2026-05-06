import { useDeferredValue, useId, useMemo, useState, type ReactNode } from 'react';

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
  density = 'comfortable',
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

  return (
    <div className={`space-y-3 ${className}`}>
      {searchable && (
        <div className="flex items-center justify-between gap-2">
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
            className="h-9 w-full max-w-xs rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm px-3 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          />
          {data.length > 0 && (
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {sorted.length} / {data.length}
            </span>
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400 py-4 text-center">{emptyMessage}</p>
      ) : (
        <>
          {/* Desktop: echte Tabelle */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-700">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`${padY} px-3 font-medium text-stone-500 dark:text-stone-400 ${alignClass(col.align)} ${
                        col.sortValue
                          ? 'cursor-pointer select-none hover:text-stone-700 dark:hover:text-stone-200'
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
                      {col.header}
                      {col.sortValue && sortKey === col.key && (
                        <span className="ml-1" aria-hidden="true">
                          {sortDir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={keyFn(row)}
                    onClick={() => onRowClick?.(row)}
                    className={`border-b border-stone-100 dark:border-stone-700/50 ${
                      onRowClick ? 'cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-700/50' : ''
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`${padY} px-3 ${alignClass(col.align)}`}
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
          <ul className="sm:hidden space-y-2">
            {visible.map((row) => {
              const primaryCol = columns.find((c) => c.primary);
              const detailCols = columns.filter((c) => !c.primary && !c.action);
              const actionCols = columns.filter((c) => c.action);
              return (
                <li
                  key={keyFn(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-3 ${
                    onRowClick ? 'cursor-pointer active:bg-stone-50 dark:active:bg-stone-700/60' : ''
                  }`}
                >
                  {primaryCol && (
                    <div className="font-medium text-stone-800 dark:text-stone-100 mb-1">
                      {primaryCol.render(row)}
                    </div>
                  )}
                  <dl className="space-y-1 text-xs">
                    {detailCols.map((col) => (
                      <div key={col.key} className="flex justify-between gap-2">
                        <dt className="text-stone-500 dark:text-stone-400">
                          {col.mobileLabel ?? col.header}
                        </dt>
                        <dd className="text-stone-700 dark:text-stone-200 text-right">
                          {col.render(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {actionCols.length > 0 && (
                    <div
                      className="flex flex-wrap items-center gap-1 mt-2 pt-2 border-t border-stone-100 dark:border-stone-700/50"
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
              className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 pt-1"
            >
              <span>
                Seite {safePage + 1} von {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(0, safePage - 1))}
                  disabled={safePage === 0}
                  className="h-8 px-3 rounded-lg border border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700 disabled:opacity-50"
                >
                  Zurück
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="h-8 px-3 rounded-lg border border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700 disabled:opacity-50"
                >
                  Weiter
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
