import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';
import { NumInput } from '../../components/shared/NumInput';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatEuro } from '../../utils/format';
import type { CostType, Cost, CostShare, Occupancy, Tenant, Unit } from '../../db/schema';

interface MessdienstInputProps {
  propertyId: number;
  year: number;
}

interface OccupancyInfo {
  occupancy: Occupancy;
  tenant: Tenant | null;
  unit: Unit | null;
}

interface CostWithShares {
  costType: CostType;
  cost: Cost | undefined;
  shares: CostShare[];
}

export function MessdienstInput({ propertyId, year }: MessdienstInputProps) {
  const messdienstName = useLiveQuery(async () => {
    const setting = await db.settings.get('messdienstName');
    return (setting?.value as string) ?? 'Messdienstleister';
  });

  const costTypes = useLiveQuery(
    () =>
      db.costTypes
        .orderBy('sortOrder')
        .toArray()
        .then((all) =>
          all.filter(
            (ct) =>
              ct.distribution === 'messdienst' || ct.distribution === 'direct',
          ),
        ),
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

  const occupancies = useLiveQuery(async () => {
    const units = await db.units
      .where('propertyId')
      .equals(propertyId)
      .toArray();

    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;
    const result: OccupancyInfo[] = [];

    for (const unit of units) {
      const occs = await db.occupancies
        .where('unitId')
        .equals(unit.id!)
        .toArray();

      const active = occs.filter(
        (o) => o.from <= yearEnd && (o.to === null || o.to >= yearStart),
      );

      for (const occ of active) {
        const tenant = (await db.tenants.get(occ.tenantId)) ?? null;
        result.push({ occupancy: occ, tenant, unit });
      }
    }

    return result;
  }, [propertyId, year]);

  const costShares = useLiveQuery(async () => {
    if (!costs || costs.length === 0) return [];
    const costIds = costs.map((c) => c.id!).filter(Boolean);
    const allShares = await db.costShares.toArray();
    return allShares.filter((s) => costIds.includes(s.costId));
  }, [costs]);

  const costsWithShares: CostWithShares[] | null =
    costTypes && costs && costShares
      ? costTypes.map((ct) => {
          const cost = costs.find((c) => c.costTypeId === ct.id!);
          const shares = cost?.id
            ? costShares.filter((s) => s.costId === cost.id!)
            : [];
          return { costType: ct, cost, shares };
        })
      : null;

  const handleShareChange = async (
    costTypeId: number,
    occupancyId: number,
    amount: number,
  ) => {
    const cost = costs?.find((c) => c.costTypeId === costTypeId);
    if (!cost?.id) return;

    const existing = costShares?.find(
      (s) => s.costId === cost.id! && s.occupancyId === occupancyId,
    );

    if (existing?.id) {
      await db.costShares.update(existing.id, { amount });
    } else {
      await db.costShares.add({
        costId: cost.id!,
        occupancyId,
        amount,
      });
    }
  };

  if (!costsWithShares || !occupancies) {
    return (
      <Card>
        <EmptyState
          icon="..."
          title="Lade Daten..."
          description="Bitte warten."
        />
      </Card>
    );
  }

  if (costsWithShares.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="📊"
          title="Keine Messdienst-Kostenarten"
          description="Es gibt keine Kostenarten mit Verteilung nach Messdienst oder Direktzuordnung."
        />
      </Card>
    );
  }

  if (occupancies.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="👤"
          title="Keine Belegungen"
          description={`Keine aktiven Belegungen im Jahr ${year} gefunden.`}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {costsWithShares.map(({ costType, cost, shares }) => {
        const sharesTotal = shares.reduce((sum, s) => sum + s.amount, 0);

        return (
          <Card
            key={costType.id}
            title={`${costType.name} \u2013 ${messdienstName}-Anteil`}
          >
            {!cost ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Bitte erfassen Sie zuerst den Gesamtbetrag unter
                &quot;Kosten erfassen&quot;.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Gesamtbetrag: {formatEuro(cost.totalAmount)} | Verteilt:{' '}
                  {formatEuro(sharesTotal)}{' '}
                  {Math.abs(cost.totalAmount - sharesTotal) > 0.01 && (
                    <span className="text-amber-600 font-medium">
                      (Differenz: {formatEuro(cost.totalAmount - sharesTotal)})
                    </span>
                  )}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 dark:border-stone-700">
                        <th className="py-2 px-3 text-left font-medium text-stone-500 dark:text-stone-400">
                          Wohnung
                        </th>
                        <th className="py-2 px-3 text-left font-medium text-stone-500 dark:text-stone-400">
                          Mieter
                        </th>
                        <th className="py-2 px-3 text-right font-medium text-stone-500 dark:text-stone-400">
                          Betrag
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {occupancies.map(({ occupancy, tenant, unit }) => {
                        const share = shares.find(
                          (s) => s.occupancyId === occupancy.id!,
                        );
                        return (
                          <tr
                            key={occupancy.id}
                            className="border-b border-stone-100 dark:border-stone-700"
                          >
                            <td className="py-2 px-3 text-stone-700 dark:text-stone-200">
                              {unit?.name ?? '\u2013'}
                            </td>
                            <td className="py-2 px-3 text-stone-700 dark:text-stone-200">
                              {tenant?.name ?? '\u2013'}
                            </td>
                            <td className="py-2 px-3">
                              <NumInput
                                value={share?.amount ?? 0}
                                onChange={(v) =>
                                  handleShareChange(
                                    costType.id!,
                                    occupancy.id!,
                                    v,
                                  )
                                }
                                suffix="\u20AC"
                                min={0}
                                className="w-32 ml-auto"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-stone-200 dark:border-stone-700">
                        <td
                          colSpan={2}
                          className="py-2 px-3 text-sm font-semibold text-stone-600 dark:text-stone-300"
                        >
                          Summe Anteile
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-tabular font-semibold text-stone-800 dark:text-stone-100">
                          {formatEuro(sharesTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
