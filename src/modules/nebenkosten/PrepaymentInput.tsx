import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';
import { NumInput } from '../../components/shared/NumInput';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatEuro } from '../../utils/format';
import type { Occupancy, Tenant, Unit, Prepayment } from '../../db/schema';

interface PrepaymentInputProps {
  propertyId: number;
  year: number;
}

interface OccupancyRow {
  occupancy: Occupancy;
  tenant: Tenant | null;
  unit: Unit | null;
  months: number;
  autoAmount: number;
  prepayment: Prepayment | undefined;
}

function getOccupiedMonths(occupancy: Occupancy, year: number): number {
  const yearStart = `${year}-01`;
  const yearEnd = `${year}-12`;
  const start = occupancy.from < yearStart ? yearStart : occupancy.from;
  const end =
    occupancy.to === null || occupancy.to > yearEnd ? yearEnd : occupancy.to;

  const [y1, m1] = start.split('-').map(Number);
  const [y2, m2] = end.split('-').map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) + 1);
}

export function PrepaymentInput({ propertyId, year }: PrepaymentInputProps) {
  const rows = useLiveQuery(async () => {
    const units = await db.units
      .where('propertyId')
      .equals(propertyId)
      .toArray();

    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;
    const result: OccupancyRow[] = [];

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
        const prepayment = await db.prepayments
          .where('[occupancyId+year]')
          .equals([occ.id!, year])
          .first();

        const months = getOccupiedMonths(occ, year);
        const autoAmount = occ.rentUtilities * months;

        result.push({
          occupancy: occ,
          tenant,
          unit,
          months,
          autoAmount,
          prepayment,
        });
      }
    }

    return result;
  }, [propertyId, year]);

  const handleChange = async (occupancyId: number, amount: number) => {
    const existing = await db.prepayments
      .where('[occupancyId+year]')
      .equals([occupancyId, year])
      .first();

    if (existing?.id) {
      await db.prepayments.update(existing.id, { amount });
    } else {
      await db.prepayments.add({
        occupancyId,
        year,
        amount,
      });
    }
  };

  const handleReset = async (occupancyId: number) => {
    const existing = await db.prepayments
      .where('[occupancyId+year]')
      .equals([occupancyId, year])
      .first();

    if (existing?.id) {
      await db.prepayments.delete(existing.id);
    }
  };

  if (!rows) {
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

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="💰"
          title="Keine Belegungen"
          description={`Keine aktiven Belegungen im Jahr ${year} gefunden.`}
        />
      </Card>
    );
  }

  const totalPrepayments = rows.reduce(
    (sum, r) => sum + (r.prepayment?.amount ?? r.autoAmount),
    0,
  );

  return (
    <Card title={`Vorauszahlungen ${year}`}>
      <p className="text-xs text-stone-500 mb-4">
        Automatisch berechnet: NK-Vorauszahlung &times; Monate. Bei Bedarf
        k\u00F6nnen Sie den Betrag manuell \u00FCberschreiben.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="py-2 px-3 text-left font-medium text-stone-500">
                Wohnung
              </th>
              <th className="py-2 px-3 text-left font-medium text-stone-500">
                Mieter
              </th>
              <th className="py-2 px-3 text-right font-medium text-stone-500">
                NK/Monat
              </th>
              <th className="py-2 px-3 text-center font-medium text-stone-500">
                Monate
              </th>
              <th className="py-2 px-3 text-right font-medium text-stone-500">
                Automatisch
              </th>
              <th className="py-2 px-3 text-right font-medium text-stone-500">
                Vorauszahlung
              </th>
              <th className="py-2 px-3 text-center font-medium text-stone-500" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOverridden = row.prepayment !== undefined;
              const effectiveAmount = row.prepayment?.amount ?? row.autoAmount;

              return (
                <tr
                  key={row.occupancy.id}
                  className="border-b border-stone-100"
                >
                  <td className="py-2 px-3 text-stone-700">
                    {row.unit?.name ?? '\u2013'}
                  </td>
                  <td className="py-2 px-3 text-stone-700">
                    {row.tenant?.name ?? '\u2013'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-tabular text-stone-600">
                    {formatEuro(row.occupancy.rentUtilities)}
                  </td>
                  <td className="py-2 px-3 text-center text-stone-600">
                    {row.months}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-tabular text-stone-500">
                    {formatEuro(row.autoAmount)}
                  </td>
                  <td className="py-2 px-3">
                    <NumInput
                      value={effectiveAmount}
                      onChange={(v) => handleChange(row.occupancy.id!, v)}
                      suffix="\u20AC"
                      min={0}
                      className="w-32 ml-auto"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    {isOverridden && (
                      <button
                        onClick={() => handleReset(row.occupancy.id!)}
                        className="text-xs text-stone-400 hover:text-stone-700"
                        title="Auf automatischen Wert zur\u00FCcksetzen"
                      >
                        Zur\u00FCcksetzen
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200">
              <td
                colSpan={5}
                className="py-2 px-3 text-sm font-semibold text-stone-600"
              >
                Gesamt Vorauszahlungen
              </td>
              <td className="py-2 px-3 text-right font-mono font-tabular font-semibold text-stone-800">
                {formatEuro(totalPrepayments)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
