import { useMemo } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { Cost, CostCategory, CostType } from "../../lib/db/schema";
import { Card } from "../../lib/ui/shared/Card";
import { NumInput } from "../../lib/ui/shared/NumInput";
import { Skeleton, useToast } from "../../lib/ui/ui";
import { formatEuro } from "../../lib/utils/format";
import { findDoubleBookingCostTypeIds } from "./doubleBooking";

interface CostEntryProps {
  propertyId: number;
  year: number;
}

const CATEGORY_LABELS: Record<CostCategory, string> = {
  tax: "Steuern & Abgaben",
  water: "Wasser & Abwasser",
  heating: "Heizung & Warmwasser",
  insurance: "Versicherungen",
  cleaning: "Reinigung & Gartenpflege",
  misc: "Sonstige Betriebskosten",
};

const CATEGORY_ORDER: CostCategory[] = ["tax", "water", "heating", "cleaning", "insurance", "misc"];

const DISTRIBUTION_LABELS: Record<string, string> = {
  area: "nach Fläche",
  persons: "nach Personen",
  units: "nach Einheiten",
  messdienst: "lt. Messdienst",
  direct: "Direktzuordnung",
};

interface CostRow {
  costType: CostType;
  cost: Cost | undefined;
}

export function CostEntry({ propertyId, year }: CostEntryProps) {
  const toast = useToast();
  const costTypes = useLiveQuery(() => db.costTypes.orderBy("sortOrder").toArray());

  const costs = useLiveQuery(
    () =>
      db.costs
        .where("propertyId")
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
      const existing = costs.find((c) => c.costTypeId === ct.id);
      groups[ct.category].push({ costType: ct, cost: existing });
    }

    return groups;
  }, [costTypes, costs]);

  const doubleBookingIds = useMemo(
    () => findDoubleBookingCostTypeIds(costTypes ?? [], costs ?? []),
    [costTypes, costs],
  );

  const handleAmountChange = async (costTypeId: number, amount: number) => {
    const existing = costs?.find((c) => c.costTypeId === costTypeId);

    try {
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
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    }
  };

  if (!grouped) {
    return (
      <div className="space-y-4">
        <Card>
          <Skeleton height="10rem" />
        </Card>
        <Card>
          <Skeleton height="10rem" />
        </Card>
      </div>
    );
  }

  const totalAll = costs?.reduce((sum, c) => sum + c.totalAmount, 0) ?? 0;

  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.map((cat) => {
        const rows = grouped[cat];
        if (rows.length === 0) return null;

        const subtotal = rows.reduce((sum, r) => sum + (r.cost?.totalAmount ?? 0), 0);

        return (
          <Card key={cat} title={CATEGORY_LABELS[cat]}>
            <div className="space-y-3">
              {rows.map((row) => {
                const costTypeId = row.costType.id;
                if (costTypeId == null) return null;
                const inputId = `cost-${costTypeId}`;
                return (
                  <div key={costTypeId} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={inputId}
                        className="block text-sm font-medium text-fg truncate"
                      >
                        {row.costType.name}
                      </label>
                      <p className="text-xs text-fg-subtle">
                        {DISTRIBUTION_LABELS[row.costType.distribution]}
                      </p>
                      {doubleBookingIds.has(costTypeId) && (
                        <p className="text-xs text-warning-fg font-medium">
                          Hinweis: Diese Position ist in der Messdienst-Abrechnung möglicherweise
                          bereits enthalten — bitte Doppelbuchung prüfen.
                        </p>
                      )}
                    </div>
                    <NumInput
                      id={inputId}
                      value={row.cost?.totalAmount ?? 0}
                      onChange={(v) => void handleAmountChange(costTypeId, v)}
                      suffix="€"
                      min={0}
                      className="w-40"
                    />
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm font-semibold text-fg-muted">Zwischensumme</span>
                <span className="text-sm font-semibold font-mono font-tabular text-fg">
                  {formatEuro(subtotal)}
                </span>
              </div>
            </div>
          </Card>
        );
      })}

      <Card>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-fg">Gesamtkosten {year}</span>
          <span className="text-base font-bold font-mono font-tabular text-fg">
            {formatEuro(totalAll)}
          </span>
        </div>
      </Card>
    </div>
  );
}
