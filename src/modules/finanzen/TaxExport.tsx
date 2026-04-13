import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { PrintLayout } from '../../components/layout/PrintLayout';
import { usePrint } from '../../hooks/usePrint';
import { formatEuro, formatArea } from '../../utils/format';
import type { FinancingData } from '../../db/schema';

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

  // Anlage V data
  const anlageV = useLiveQuery(async () => {
    if (!activeProperty?.id) return null;
    const propertyId = activeProperty.id;

    const units = await db.units.where('propertyId').equals(propertyId).toArray();
    const totalArea = units.reduce((s, u) => s + u.area, 0);

    const costTypes = await db.costTypes.toArray();
    const costs = await db.costs.where('propertyId').equals(propertyId).toArray();
    const yearCosts = costs.filter((c) => c.year === year);

    const taxTypeIds = costTypes.filter((ct) => ct.category === 'tax').map((ct) => ct.id!);
    const insuranceTypeIds = costTypes.filter((ct) => ct.category === 'insurance').map((ct) => ct.id!);

    const grundsteuer = yearCosts.filter((c) => taxTypeIds.includes(c.costTypeId)).reduce((s, c) => s + c.totalAmount, 0);
    const versicherungen = yearCosts.filter((c) => insuranceTypeIds.includes(c.costTypeId)).reduce((s, c) => s + c.totalAmount, 0);

    const financingSetting = await db.settings.get(`financing_${propertyId}`);
    const financing = financingSetting?.value as FinancingData | undefined;

    const afa = financing && financing.afaSatz > 0 ? financing.kaufpreis * financing.afaSatz / 100 : 0;
    const schuldzinsen = financing ? financing.kreditbetrag * financing.zinssatz / 100 : 0;

    const unitIds = units.map((u) => u.id!);
    const allMaintenance = await db.maintenanceItems.toArray();
    const erhaltung = allMaintenance
      .filter((m) => m.date.startsWith(`${year}`) && m.category === 'repair' && (m.unitId === null || unitIds.includes(m.unitId!)))
      .reduce((s, m) => s + m.cost, 0);

    return { totalArea, grundsteuer, versicherungen, afa, schuldzinsen, erhaltung };
  }, [activeProperty?.id, year]);

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
          <tr className="border-b-2 border-stone-300 dark:border-stone-600">
            <th className="py-2 px-3 text-left font-medium text-stone-600 dark:text-stone-300">
              Einheit
            </th>
            <th className="py-2 px-3 text-left font-medium text-stone-600 dark:text-stone-300">
              Mieter
            </th>
            <th className="py-2 px-3 text-left font-medium text-stone-600 dark:text-stone-300">
              Zeitraum
            </th>
            <th className="py-2 px-3 text-right font-medium text-stone-600 dark:text-stone-300">
              Kaltmiete
            </th>
            <th className="py-2 px-3 text-right font-medium text-stone-600 dark:text-stone-300">
              Nebenkosten
            </th>
            <th className="py-2 px-3 text-right font-medium text-stone-600 dark:text-stone-300">
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
              <tr key={row.id} className="border-b border-stone-100 dark:border-stone-700">
                <td className="py-2.5 px-3 font-medium text-stone-700 dark:text-stone-200">
                  {row.unitName}
                </td>
                <td className="py-2.5 px-3 text-stone-600 dark:text-stone-300">
                  {row.tenantName}
                </td>
                <td className="py-2.5 px-3 text-stone-500 dark:text-stone-400 text-xs">
                  {fromDisplay} – {toDisplay}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-stone-700 dark:text-stone-200">
                  {formatEuro(row.totalCold)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-stone-700 dark:text-stone-200">
                  {formatEuro(row.totalUtilities)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-medium text-stone-800 dark:text-stone-100">
                  {formatEuro(row.totalReceived)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-stone-300 dark:border-stone-600">
            <td
              colSpan={3}
              className="py-3 px-3 font-semibold text-stone-800 dark:text-stone-100"
            >
              Summe {year}
            </td>
            <td className="py-3 px-3 text-right font-mono font-semibold text-stone-800 dark:text-stone-100">
              {formatEuro(grandTotalCold)}
            </td>
            <td className="py-3 px-3 text-right font-mono font-semibold text-stone-800 dark:text-stone-100">
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

  const werbungskosten = anlageV
    ? anlageV.grundsteuer + anlageV.afa + anlageV.schuldzinsen + anlageV.erhaltung + anlageV.versicherungen
    : 0;
  const einnahmenGesamt = grandTotalCold + grandTotalUtilities;
  const einkuenfte = einnahmenGesamt - werbungskosten;

  const anlageVRows: { zeile: string; label: string; value: string; bold?: boolean; highlight?: boolean }[] = anlageV ? [
    { zeile: '9', label: 'Lage des Grundstücks', value: activeProperty?.address || '–' },
    { zeile: '13', label: 'Gesamtwohnfläche', value: formatArea(anlageV.totalArea) },
    { zeile: '33', label: 'Mieteinnahmen für Wohnungen', value: formatEuro(grandTotalCold) },
    { zeile: '35', label: 'Umlagen (NK erhalten)', value: formatEuro(grandTotalUtilities) },
    { zeile: '37', label: 'Vereinnahmte Mieten gesamt', value: formatEuro(einnahmenGesamt), bold: true },
    { zeile: '47', label: 'Grundsteuer', value: formatEuro(anlageV.grundsteuer) },
    { zeile: '48', label: 'AfA (Absetzung für Abnutzung)', value: anlageV.afa > 0 ? formatEuro(anlageV.afa) : '–' },
    { zeile: '49', label: 'Schuldzinsen', value: anlageV.schuldzinsen > 0 ? formatEuro(anlageV.schuldzinsen) : '–' },
    { zeile: '50', label: 'Erhaltungsaufwendungen', value: formatEuro(anlageV.erhaltung) },
    { zeile: '52', label: 'Versicherungen', value: formatEuro(anlageV.versicherungen) },
    { zeile: '56', label: 'Summe Werbungskosten', value: formatEuro(werbungskosten), bold: true },
    { zeile: '57', label: 'Einkünfte aus V+V', value: formatEuro(einkuenfte), highlight: true },
  ] : [];

  const anlageVContent = anlageV && (
    <Card title="Anlage V – Übertragungshilfe für Elster">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-stone-300 dark:border-stone-600">
            <th className="py-2 px-2 text-left font-medium text-stone-500 dark:text-stone-400 w-16">Zeile</th>
            <th className="py-2 px-3 text-left font-medium text-stone-600 dark:text-stone-300">Bezeichnung</th>
            <th className="py-2 px-3 text-right font-medium text-stone-600 dark:text-stone-300">Wert</th>
          </tr>
        </thead>
        <tbody>
          {anlageVRows.map((row) => (
            <tr
              key={row.zeile}
              className={`border-b border-stone-100 dark:border-stone-700 ${row.highlight ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
            >
              <td className="py-2 px-2 text-xs text-stone-400 dark:text-stone-500 font-mono">{row.zeile}</td>
              <td className={`py-2 px-3 ${row.bold || row.highlight ? 'font-semibold' : ''} text-stone-700 dark:text-stone-200`}>
                {row.label}
              </td>
              <td className={`py-2 px-3 text-right font-mono ${row.highlight ? 'font-bold text-emerald-700 dark:text-emerald-400' : row.bold ? 'font-semibold text-stone-800 dark:text-stone-100' : 'text-stone-700 dark:text-stone-200'}`}>
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-stone-400 dark:text-stone-500 mt-4">
        Die Angaben dienen als Ausfüllhilfe für die Anlage V der Einkommensteuererklärung.
        Bitte prüfen Sie alle Werte vor der Übertragung in ELSTER.
      </p>
    </Card>
  );

  if (isPrinting) {
    return (
      <PrintLayout
        title={`Mieteinnahmen ${year}`}
        subtitle={activeProperty?.name ?? ''}
      >
        {tableContent}
        {anlageVContent}
      </PrintLayout>
    );
  }

  return (
    <div className="space-y-4">
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
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-4">
              Alle Beträge in Euro. Nur tatsächlich eingegangene Zahlungen.
            </p>
          </>
        )}
      </Card>
      {anlageVContent}
    </div>
  );
}

/** Format "2024-03" to "03/2024" for compact display */
function formatPeriod(ym: string): string {
  const [y, m] = ym.split('-');
  return `${m}/${y}`;
}
