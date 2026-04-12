import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { BarChart } from '../../components/charts/BarChart';
import { DonutChart } from '../../components/charts/DonutChart';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatEuro } from '../../utils/format';
import type { MaintenanceItem, Unit } from '../../db/schema';

type Category = MaintenanceItem['category'];

const CATEGORY_LABELS: Record<Category, string> = {
  repair: 'Reparatur',
  maintenance: 'Wartung',
  inspection: 'Prüfung',
  modernization: 'Modernisierung',
};

const CATEGORY_COLORS: string[] = ['#ef4444', '#d97706', '#0891b2', '#7c3aed'];

interface UnitCostRow {
  unitName: string;
  total: number;
  repair: number;
  maintenance: number;
  inspection: number;
  modernization: number;
}

export function CostBreakdown() {
  const { activeProperty } = useProperty();

  const units = useLiveQuery(
    () =>
      activeProperty?.id
        ? db.units.where('propertyId').equals(activeProperty.id).toArray()
        : Promise.resolve([] as Unit[]),
    [activeProperty?.id],
  );

  const unitIds = useMemo(() => (units ?? []).map((u) => u.id!), [units]);
  const unitMap = useMemo(() => {
    const map = new Map<number, Unit>();
    for (const u of units ?? []) {
      map.set(u.id!, u);
    }
    return map;
  }, [units]);

  const items = useLiveQuery(
    async () => {
      if (!activeProperty?.id) return [];
      const all = await db.maintenanceItems.toArray();
      return all.filter(
        (item) => item.unitId === null || unitIds.includes(item.unitId),
      );
    },
    [activeProperty?.id, unitIds],
  );

  const availableYears = useMemo(() => {
    if (!items || items.length === 0) return [];
    const years = new Set(items.map((i) => parseInt(i.date.slice(0, 4))));
    return Array.from(years).sort((a, b) => b - a);
  }, [items]);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Auto-select latest year when data loads
  const effectiveYear = selectedYear ?? (availableYears.length > 0 ? availableYears[0] : null);

  // Costs per year for bar chart
  const costsByYear = useMemo(() => {
    if (!items || items.length === 0) return { labels: [] as string[], data: [] as number[] };
    const yearMap = new Map<number, number>();
    for (const item of items) {
      const year = parseInt(item.date.slice(0, 4));
      yearMap.set(year, (yearMap.get(year) ?? 0) + item.cost);
    }
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b);
    return {
      labels: sortedYears.map(String),
      data: sortedYears.map((y) => yearMap.get(y)!),
    };
  }, [items]);

  // Costs by category for selected year (donut chart)
  const costsByCategory = useMemo(() => {
    if (!items || effectiveYear === null)
      return { labels: [] as string[], data: [] as number[], colors: [] as string[] };
    const yearItems = items.filter(
      (i) => parseInt(i.date.slice(0, 4)) === effectiveYear,
    );
    const categories: Category[] = ['repair', 'maintenance', 'inspection', 'modernization'];
    const sums = categories.map((cat) =>
      yearItems
        .filter((i) => i.category === cat)
        .reduce((sum, i) => sum + i.cost, 0),
    );
    // Only include categories with costs > 0
    const filtered = categories
      .map((cat, idx) => ({ label: CATEGORY_LABELS[cat], value: sums[idx], color: CATEGORY_COLORS[idx] }))
      .filter((c) => c.value > 0);

    return {
      labels: filtered.map((c) => c.label),
      data: filtered.map((c) => c.value),
      colors: filtered.map((c) => c.color),
    };
  }, [items, effectiveYear]);

  // Costs per unit for selected year
  const unitCostRows: UnitCostRow[] = useMemo(() => {
    if (!items || effectiveYear === null) return [];
    const yearItems = items.filter(
      (i) => parseInt(i.date.slice(0, 4)) === effectiveYear,
    );

    const groupMap = new Map<string, UnitCostRow>();

    for (const item of yearItems) {
      const name =
        item.unitId === null
          ? 'Gemeinschaft'
          : (unitMap.get(item.unitId)?.name ?? 'Unbekannt');

      let row = groupMap.get(name);
      if (!row) {
        row = { unitName: name, total: 0, repair: 0, maintenance: 0, inspection: 0, modernization: 0 };
        groupMap.set(name, row);
      }
      row.total += item.cost;
      row[item.category] += item.cost;
    }

    return Array.from(groupMap.values()).sort((a, b) => b.total - a.total);
  }, [items, unitMap, effectiveYear]);

  const totalSelectedYear = useMemo(
    () => unitCostRows.reduce((sum, r) => sum + r.total, 0),
    [unitCostRows],
  );

  const unitColumns: Column<UnitCostRow>[] = [
    {
      key: 'unit',
      header: 'Wohnung',
      render: (r) => (
        <span className={`font-medium ${r.unitName === 'Gemeinschaft' ? 'text-stone-500 italic' : ''}`}>
          {r.unitName}
        </span>
      ),
      sortValue: (r) => r.unitName,
    },
    {
      key: 'repair',
      header: 'Reparatur',
      render: (r) => <span className="font-mono">{formatEuro(r.repair)}</span>,
      sortValue: (r) => r.repair,
      align: 'right',
    },
    {
      key: 'maintenance',
      header: 'Wartung',
      render: (r) => <span className="font-mono">{formatEuro(r.maintenance)}</span>,
      sortValue: (r) => r.maintenance,
      align: 'right',
    },
    {
      key: 'inspection',
      header: 'Prüfung',
      render: (r) => <span className="font-mono">{formatEuro(r.inspection)}</span>,
      sortValue: (r) => r.inspection,
      align: 'right',
    },
    {
      key: 'modernization',
      header: 'Modernisierung',
      render: (r) => <span className="font-mono">{formatEuro(r.modernization)}</span>,
      sortValue: (r) => r.modernization,
      align: 'right',
    },
    {
      key: 'total',
      header: 'Gesamt',
      render: (r) => <span className="font-mono font-semibold">{formatEuro(r.total)}</span>,
      sortValue: (r) => r.total,
      align: 'right',
    },
  ];

  if (!items || items.length === 0) {
    return (
      <Card title="Kostenauswertung">
        <EmptyState
          icon="📊"
          title="Keine Kostendaten"
          description="Sobald Maßnahmen erfasst sind, sehen Sie hier die Kostenauswertung."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <Card
        title="Kostenauswertung"
        action={
          <select
            value={effectiveYear ?? ''}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="text-sm border border-stone-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        }
      >
        <p className="text-sm text-stone-600">
          Gesamtkosten {effectiveYear}:{' '}
          <span className="font-semibold font-mono">{formatEuro(totalSelectedYear)}</span>
        </p>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Kosten pro Jahr">
          {costsByYear.labels.length > 0 ? (
            <div style={{ height: 250 }}>
              <BarChart
                labels={costsByYear.labels}
                datasets={[{ label: 'Kosten', data: costsByYear.data, color: '#78716c' }]}
                height={250}
              />
            </div>
          ) : (
            <p className="text-sm text-stone-500 text-center py-8">Keine Daten</p>
          )}
        </Card>

        <Card title={`Kosten nach Kategorie ${effectiveYear ?? ''}`}>
          {costsByCategory.data.length > 0 ? (
            <div style={{ height: 250 }}>
              <DonutChart
                labels={costsByCategory.labels}
                data={costsByCategory.data}
                colors={costsByCategory.colors}
                height={250}
              />
            </div>
          ) : (
            <p className="text-sm text-stone-500 text-center py-8">Keine Daten für dieses Jahr</p>
          )}
        </Card>
      </div>

      {/* Cost per unit table */}
      <Card title={`Kosten pro Wohnung ${effectiveYear ?? ''}`}>
        {unitCostRows.length > 0 ? (
          <DataTable
            columns={unitColumns}
            data={unitCostRows}
            keyFn={(r) => r.unitName}
          />
        ) : (
          <p className="text-sm text-stone-500 text-center py-4">
            Keine Kosten für dieses Jahr vorhanden.
          </p>
        )}
      </Card>
    </div>
  );
}
