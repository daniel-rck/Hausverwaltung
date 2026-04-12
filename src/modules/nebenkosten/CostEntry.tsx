import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';
import { NumInput } from '../../components/shared/NumInput';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatEuro } from '../../utils/format';
import type { CostType, Cost, CostCategory } from '../../db/schema';

interface CostEntryProps {
  propertyId: number;
  year: number;
}

const CATEGORY_LABELS: Record<CostCategory, string> = {
  tax: 'Steuern & Abgaben',
  water: 'Wasser & Abwasser',
  heating: 'Heizung & Warmwasser',
  insurance: 'Versicherungen',
  cleaning: 'Reinigung & Gartenpflege',
  misc: 'Sonstige Betriebskosten',
};

const CATEGORY_ORDER: CostCategory[] = [
  'tax',
  'water',
  'heating',
  'cleaning',
  'insurance',
  'misc',
];

const DISTRIBUTION_LABELS: Record<string, string> = {
  area: 'nach Fläche',
  persons: 'nach Personen',
  units: 'nach Einheiten',
  messdienst: 'lt. Messdienst',
  direct: 'Direktzuordnung',
};

interface CostRow {
  costType: CostType;
  cost: Cost | undefined;
}

export function CostEntry({ propertyId, year }: CostEntryProps) {
  const costTypes = useLiveQuery(() =>
    db.costTypes.orderBy('sortOrder').toArray(),
  );

  const costs = useLiveQuery(
    () =>
      db.costs
        .where('propertyId')
        .equals(propertyId)
        .toArray()
        .then((all) => all.filter((c) => c.year === year)),
    [propertyId, year],
  );

  const grouped = useMemo(() => {
    if (!costTypes || !costs) return null;

    const groups: Record<CostCategory, CostRow[]> = {
      tax: [],
      water: [],
      heating: [],
      insurance: [],
      cleaning: [],
      misc: [],
    };

    for (const ct of costTypes) {
      const existing = costs.find((c) => c.costTypeId === ct.id!);
      groups[ct.category].push({ costType: ct, cost: existing });
    }

    return groups;
  }, [costTypes, costs]);

  const handleAmountChange = async (costTypeId: number, amount: number) => {
    const existing = costs?.find((c) => c.costTypeId === costTypeId);

    if (existing?.id) {
      await db.costs.update(existing.id, { totalAmount: amount });
    } else {
      await db.costs.add({
        propertyId,
        year,
        costTypeId,
        totalAmount: amount,
      });
    }
  };

  if (!grouped) {
    return (
      <Card>
        <EmptyState
          icon="..."
          title="Lade Kostenarten..."
          description="Bitte warten."
        />
      </Card>
    );
  }

  const totalAll = costs?.reduce((sum, c) => sum + c.totalAmount, 0) ?? 0;

  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.map((cat) => {
        const rows = grouped[cat];
        if (rows.length === 0) return null;

        const subtotal = rows.reduce(
          (sum, r) => sum + (r.cost?.totalAmount ?? 0),
          0,
        );

        return (
          <Card key={cat} title={CATEGORY_LABELS[cat]}>
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.costType.id}
                  className="flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">
                      {row.costType.name}
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500">
                      {DISTRIBUTION_LABELS[row.costType.distribution]}
                    </p>
                  </div>
                  <NumInput
                    value={row.cost?.totalAmount ?? 0}
                    onChange={(v) => handleAmountChange(row.costType.id!, v)}
                    suffix="\u20AC"
                    min={0}
                    className="w-40"
                  />
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-700">
                <span className="text-sm font-semibold text-stone-600 dark:text-stone-300">
                  Zwischensumme
                </span>
                <span className="text-sm font-semibold font-mono font-tabular text-stone-800 dark:text-stone-100">
                  {formatEuro(subtotal)}
                </span>
              </div>
            </div>
          </Card>
        );
      })}

      <Card>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-stone-800 dark:text-stone-100">
            Gesamtkosten {year}
          </span>
          <span className="text-base font-bold font-mono font-tabular text-stone-800 dark:text-stone-100">
            {formatEuro(totalAll)}
          </span>
        </div>
      </Card>
    </div>
  );
}
