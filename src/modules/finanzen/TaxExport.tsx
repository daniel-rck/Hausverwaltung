import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { PrintLayout } from '../../components/layout/PrintLayout';
import { usePrint } from '../../hooks/usePrint';
import { formatEuro } from '../../utils/format';


interface TaxRow {
  id: string;
  unitName: string;
  tenantName: string;
  occupancyFrom: string;
  occupancyTo: string | null;
  totalCold: number;
  totalUtilities: number;
  totalReceived: number;
}

interface TaxExportProps {
  year: number;
}

export function TaxExport({ year }: TaxExportProps) {
  const { activeProperty } = useProperty();
  const { isPrinting, print } = usePrint();

  const data = useLiveQuery(async () => {
    if (!activeProperty?.id) return null;

    const units = await db.units
      .where('propertyId')
      .equals(activeProperty.id)
      .toArray();

    const unitIds = units.map((u) => u.id!);
    const allOccupancies = await db.occupancies.toArray();
    const occupancies = allOccupancies.filter((o) => unitIds.includes(o.unitId));

    const tenantIds = [...new Set(occupancies.map((o) => o.tenantId))];
    const tenants = await db.tenants.bulkGet(tenantIds);
    const tenantMap = new Map(
      tenants.filter(Boolean).map((t) => [t!.id!, t!])
    );

    const unitMap = new Map(units.map((u) => [u.id!, u]));

    const allPayments = await db.payments.toArray();

    return { occupancies, unitMap, tenantMap, allPayments };
  }, [activeProperty?.id]);

  const rows = useMemo((): TaxRow[] => {
    if (!data) return [];

    const { occupancies, unitMap, tenantMap, allPayments } = data;
    const result: TaxRow[] = [];

    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;

    // Group payments by occupancy
    const paymentsByOcc = new Map<number, { cold: number; utilities: number }>();
    for (const p of allPayments) {
      if (!p.month.startsWith(`${year}-`)) continue;
      const existing = paymentsByOcc.get(p.occupancyId) ?? {
        cold: 0,
        utilities: 0,
      };
      existing.cold += p.amountCold;
      existing.utilities += p.amountUtilities;
      paymentsByOcc.set(p.occupancyId, existing);
    }

    for (const occ of occupancies) {
      if (occ.from > yearEnd || (occ.to !== null && occ.to < yearStart))
        continue;

      const unit = unitMap.get(occ.unitId);
      const tenant = tenantMap.get(occ.tenantId);
      if (!unit || !tenant) continue;

      const payments = paymentsByOcc.get(occ.id!) ?? {
        cold: 0,
        utilities: 0,
      };

      result.push({
        id: `${occ.id}`,
        unitName: unit.name,
        tenantName: tenant.name,
        occupancyFrom: occ.from,
        occupancyTo: occ.to,
        totalCold: payments.cold,
        totalUtilities: payments.utilities,
        totalReceived: payments.cold + payments.utilities,
      });
    }

    // Sort by unit name
    result.sort((a, b) => a.unitName.localeCompare(b.unitName));

    return result;
  }, [data, year]);

  if (!data) return null;

  const grandTotalCold = rows.reduce((s, r) => s + r.totalCold, 0);
  const grandTotalUtilities = rows.reduce((s, r) => s + r.totalUtilities, 0);
  const grandTotal = rows.reduce((s, r) => s + r.totalReceived, 0);

  const tableContent = (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-stone-300">
            <th className="py-2 px-3 text-left font-medium text-stone-600">
              Einheit
            </th>
            <th className="py-2 px-3 text-left font-medium text-stone-600">
              Mieter
            </th>
            <th className="py-2 px-3 text-left font-medium text-stone-600">
              Zeitraum
            </th>
            <th className="py-2 px-3 text-right font-medium text-stone-600">
              Kaltmiete
            </th>
            <th className="py-2 px-3 text-right font-medium text-stone-600">
              Nebenkosten
            </th>
            <th className="py-2 px-3 text-right font-medium text-stone-600">
              Gesamt
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const fromDisplay = formatPeriod(row.occupancyFrom);
            const toDisplay = row.occupancyTo
              ? formatPeriod(row.occupancyTo)
              : 'laufend';
            return (
              <tr key={row.id} className="border-b border-stone-100">
                <td className="py-2.5 px-3 font-medium text-stone-700">
                  {row.unitName}
                </td>
                <td className="py-2.5 px-3 text-stone-600">
                  {row.tenantName}
                </td>
                <td className="py-2.5 px-3 text-stone-500 text-xs">
                  {fromDisplay} – {toDisplay}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-stone-700">
                  {formatEuro(row.totalCold)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-stone-700">
                  {formatEuro(row.totalUtilities)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-medium text-stone-800">
                  {formatEuro(row.totalReceived)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-stone-300">
            <td
              colSpan={3}
              className="py-3 px-3 font-semibold text-stone-800"
            >
              Summe {year}
            </td>
            <td className="py-3 px-3 text-right font-mono font-semibold text-stone-800">
              {formatEuro(grandTotalCold)}
            </td>
            <td className="py-3 px-3 text-right font-mono font-semibold text-stone-800">
              {formatEuro(grandTotalUtilities)}
            </td>
            <td className="py-3 px-3 text-right font-mono font-bold text-stone-900">
              {formatEuro(grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  if (isPrinting) {
    return (
      <PrintLayout
        title={`Mieteinnahmen ${year}`}
        subtitle={activeProperty?.name ?? ''}
      >
        {tableContent}
      </PrintLayout>
    );
  }

  return (
    <Card
      title="Steuer-Export"
      action={
        rows.length > 0 ? (
          <button
            onClick={print}
            className="px-3 py-1.5 text-xs bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors"
          >
            Drucken
          </button>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="📄"
          title="Keine Einnahmen"
          description={`Für ${year} wurden noch keine Zahlungen erfasst.`}
        />
      ) : (
        <>
          {tableContent}
          <p className="text-xs text-stone-400 mt-4">
            Alle Beträge in Euro. Nur tatsächlich eingegangene Zahlungen.
            Geeignet als Anlage zur Steuererklärung (Anlage V).
          </p>
        </>
      )}
    </Card>
  );
}

/** Format "2024-03" to "03/2024" for compact display */
function formatPeriod(ym: string): string {
  const [y, m] = ym.split('-');
  return `${m}/${y}`;
}
