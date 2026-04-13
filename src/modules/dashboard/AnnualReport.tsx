import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatEuro, formatPercent } from '../../utils/format';
import type { FinancingData } from '../../db/schema';

interface AnnualReportProps {
  propertyId: number;
}

export function AnnualReport({ propertyId }: AnnualReportProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const data = useLiveQuery(async () => {
    const units = await db.units
      .where('propertyId')
      .equals(propertyId)
      .toArray();

    const unitIds = units.map((u) => u.id!);
    if (unitIds.length === 0) return null;

    const totalUnits = units.length;

    // Occupancies for this property
    const allOccupancies = await db.occupancies.toArray();
    const occupancies = allOccupancies.filter((o) => unitIds.includes(o.unitId));

    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;

    // Active occupancies during the year
    const relevantOccs = occupancies.filter(
      (o) => o.from <= yearEnd && (o.to === null || o.to >= yearStart),
    );

    // --- Einnahmen (from payments) ---
    const allPayments = await db.payments.toArray();
    const occIds = new Set(occupancies.map((o) => o.id!));
    const yearPayments = allPayments.filter(
      (p) => p.month.startsWith(`${year}-`) && occIds.has(p.occupancyId),
    );

    const totalColdReceived = yearPayments.reduce(
      (s, p) => s + p.amountCold,
      0,
    );
    const totalUtilitiesReceived = yearPayments.reduce(
      (s, p) => s + p.amountUtilities,
      0,
    );
    const totalEinnahmen = totalColdReceived + totalUtilitiesReceived;

    // --- Ausgaben ---
    // Costs from cost table
    const allCosts = await db.costs
      .where('propertyId')
      .equals(propertyId)
      .toArray();
    const yearCosts = allCosts.filter((c) => c.year === year);
    const totalNebenkosten = yearCosts.reduce(
      (s, c) => s + c.totalAmount,
      0,
    );

    // Maintenance costs
    const allMaintenance = await db.maintenanceItems.toArray();
    const yearMaintenance = allMaintenance.filter(
      (m) =>
        m.date.startsWith(`${year}`) &&
        (m.unitId === null || unitIds.includes(m.unitId)),
    );
    const totalInstandhaltung = yearMaintenance.reduce(
      (s, m) => s + m.cost,
      0,
    );

    // Financing: Schuldzinsen + AfA
    const financingSetting = await db.settings.get(`financing_${propertyId}`);
    const financing = (financingSetting?.value as FinancingData) ?? null;

    const schuldzinsen = financing
      ? (financing.kreditbetrag * financing.zinssatz) / 100
      : 0;
    const afa =
      financing && financing.afaSatz > 0
        ? (financing.kaufpreis * financing.afaSatz) / 100
        : 0;

    const totalAusgaben =
      totalNebenkosten + totalInstandhaltung + schuldzinsen + afa;

    // --- Ergebnis ---
    const ergebnis = totalEinnahmen - totalAusgaben;

    // --- Leerstand ---
    // For each month of the year, count how many units are vacant
    let vacantMonths = 0;
    const totalMonths = totalUnits * 12;

    for (let m = 1; m <= 12; m++) {
      const month = `${year}-${String(m).padStart(2, '0')}`;
      const occupiedUnitIds = new Set(
        relevantOccs
          .filter(
            (o) => o.from <= month && (o.to === null || o.to >= month),
          )
          .map((o) => o.unitId),
      );
      vacantMonths += totalUnits - occupiedUnitIds.size;
    }

    // --- Offene Posten ---
    // For each active occupancy+month, check if payment is missing/partial
    const paymentMap = new Map<string, number>();
    for (const p of yearPayments) {
      const key = `${p.occupancyId}-${p.month}`;
      paymentMap.set(key, (paymentMap.get(key) ?? 0) + p.amountCold + p.amountUtilities);
    }

    let openCount = 0;
    let openSum = 0;

    const now = new Date();
    const currentMonth =
      now.getFullYear() === year
        ? `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`
        : yearEnd;

    for (const occ of relevantOccs) {
      for (let m = 1; m <= 12; m++) {
        const month = `${year}-${String(m).padStart(2, '0')}`;
        if (month > currentMonth) break;
        if (month < occ.from) continue;
        if (occ.to !== null && month > occ.to) continue;

        const expected = occ.rentCold + occ.rentUtilities;
        const received = paymentMap.get(`${occ.id}-${month}`) ?? 0;
        if (received < expected) {
          openCount++;
          openSum += expected - received;
        }
      }
    }

    // --- Rendite ---
    const kaufpreis = financing?.kaufpreis ?? 0;
    const bruttomietrendite =
      kaufpreis > 0 ? (totalColdReceived / kaufpreis) : null;

    return {
      totalColdReceived,
      totalUtilitiesReceived,
      totalEinnahmen,
      totalNebenkosten,
      totalInstandhaltung,
      schuldzinsen,
      afa,
      totalAusgaben,
      ergebnis,
      vacantMonths,
      totalMonths,
      openCount,
      openSum,
      bruttomietrendite,
      hasFinancing: financing !== null,
    };
  }, [propertyId, year]);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 10; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  if (data === undefined) return null;

  if (data === null) {
    return (
      <Card>
        <EmptyState
          icon="📊"
          title="Keine Einheiten vorhanden"
          description="Legen Sie zuerst Wohneinheiten an, um den Jahresabschluss zu sehen."
        />
      </Card>
    );
  }

  const ergebnisPositive = data.ergebnis >= 0;
  const vacancyRate =
    data.totalMonths > 0 ? data.vacantMonths / data.totalMonths : 0;

  return (
    <div className="space-y-4">
      {/* Year selector + print button */}
      <div className="no-print flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-stone-600 dark:text-stone-300">
            Jahr:
          </label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm bg-stone-800 dark:bg-stone-600 text-white rounded-lg hover:bg-stone-900 dark:hover:bg-stone-500 transition-colors"
        >
          Drucken
        </button>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <div className="text-center">
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">
              Einnahmen
            </p>
            <p className="text-xl font-semibold font-mono font-tabular text-green-600">
              {formatEuro(data.totalEinnahmen)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">
              Ausgaben
            </p>
            <p className="text-xl font-semibold font-mono font-tabular text-red-600">
              {formatEuro(data.totalAusgaben)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">
              Ergebnis
            </p>
            <p
              className={`text-xl font-bold font-mono font-tabular ${
                ergebnisPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatEuro(data.ergebnis)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">
              Leerstand
            </p>
            <p
              className={`text-xl font-semibold font-mono font-tabular ${
                data.vacantMonths > 0
                  ? 'text-amber-600'
                  : 'text-stone-400 dark:text-stone-500'
              }`}
            >
              {data.vacantMonths} / {data.totalMonths} Mon.
            </p>
          </div>
        </Card>
      </div>

      {/* Detailed table */}
      <Card title={`Jahresabschluss ${year}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* Einnahmen section */}
            <thead>
              <tr className="border-b-2 border-stone-300 dark:border-stone-600">
                <th
                  colSpan={2}
                  className="py-2 px-3 text-left font-semibold text-stone-800 dark:text-stone-100"
                >
                  Einnahmen
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-stone-100 dark:border-stone-700">
                <td className="py-2 px-3 text-stone-600 dark:text-stone-300">
                  Kaltmiete (erhalten)
                </td>
                <td className="py-2 px-3 text-right font-mono text-stone-700 dark:text-stone-200">
                  {formatEuro(data.totalColdReceived)}
                </td>
              </tr>
              <tr className="border-b border-stone-100 dark:border-stone-700">
                <td className="py-2 px-3 text-stone-600 dark:text-stone-300">
                  Nebenkostenvorauszahlungen (erhalten)
                </td>
                <td className="py-2 px-3 text-right font-mono text-stone-700 dark:text-stone-200">
                  {formatEuro(data.totalUtilitiesReceived)}
                </td>
              </tr>
              <tr className="border-b-2 border-stone-300 dark:border-stone-600 font-semibold">
                <td className="py-2 px-3 text-stone-800 dark:text-stone-100">
                  Summe Einnahmen
                </td>
                <td className="py-2 px-3 text-right font-mono text-green-600">
                  {formatEuro(data.totalEinnahmen)}
                </td>
              </tr>
            </tbody>

            {/* Ausgaben section */}
            <thead>
              <tr className="border-b-2 border-stone-300 dark:border-stone-600">
                <th
                  colSpan={2}
                  className="py-2 px-3 text-left font-semibold text-stone-800 dark:text-stone-100 pt-4"
                >
                  Ausgaben
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-stone-100 dark:border-stone-700">
                <td className="py-2 px-3 text-stone-600 dark:text-stone-300">
                  Nebenkosten / Betriebskosten
                </td>
                <td className="py-2 px-3 text-right font-mono text-stone-700 dark:text-stone-200">
                  {formatEuro(data.totalNebenkosten)}
                </td>
              </tr>
              <tr className="border-b border-stone-100 dark:border-stone-700">
                <td className="py-2 px-3 text-stone-600 dark:text-stone-300">
                  Instandhaltung / Reparaturen
                </td>
                <td className="py-2 px-3 text-right font-mono text-stone-700 dark:text-stone-200">
                  {formatEuro(data.totalInstandhaltung)}
                </td>
              </tr>
              {data.schuldzinsen > 0 && (
                <tr className="border-b border-stone-100 dark:border-stone-700">
                  <td className="py-2 px-3 text-stone-600 dark:text-stone-300">
                    Schuldzinsen
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-stone-700 dark:text-stone-200">
                    {formatEuro(data.schuldzinsen)}
                  </td>
                </tr>
              )}
              {data.afa > 0 && (
                <tr className="border-b border-stone-100 dark:border-stone-700">
                  <td className="py-2 px-3 text-stone-600 dark:text-stone-300">
                    Abschreibung (AfA)
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-stone-700 dark:text-stone-200">
                    {formatEuro(data.afa)}
                  </td>
                </tr>
              )}
              <tr className="border-b-2 border-stone-300 dark:border-stone-600 font-semibold">
                <td className="py-2 px-3 text-stone-800 dark:text-stone-100">
                  Summe Ausgaben
                </td>
                <td className="py-2 px-3 text-right font-mono text-red-600">
                  {formatEuro(data.totalAusgaben)}
                </td>
              </tr>
            </tbody>

            {/* Ergebnis */}
            <tfoot>
              <tr>
                <td className="py-3 px-3 font-bold text-stone-900 dark:text-stone-50 text-base">
                  Ergebnis
                </td>
                <td
                  className={`py-3 px-3 text-right font-mono font-bold text-base ${
                    ergebnisPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatEuro(data.ergebnis)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Additional details */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Leerstand */}
          <div className="p-3 bg-stone-50 dark:bg-stone-700/30 rounded-lg">
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">
              Leerstand
            </p>
            <p className="font-semibold font-mono text-stone-800 dark:text-stone-100">
              {data.vacantMonths} von {data.totalMonths} Monaten
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Leerstandsquote: {formatPercent(vacancyRate)}
            </p>
          </div>

          {/* Offene Posten */}
          <div className="p-3 bg-stone-50 dark:bg-stone-700/30 rounded-lg">
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">
              Offene Posten
            </p>
            <p
              className={`font-semibold font-mono ${
                data.openCount > 0
                  ? 'text-red-600'
                  : 'text-stone-800 dark:text-stone-100'
              }`}
            >
              {data.openCount > 0
                ? `${data.openCount} offen (${formatEuro(data.openSum)})`
                : 'Keine'}
            </p>
          </div>

          {/* Rendite */}
          <div className="p-3 bg-stone-50 dark:bg-stone-700/30 rounded-lg">
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">
              Bruttomietrendite
            </p>
            <p className="font-semibold font-mono text-stone-800 dark:text-stone-100">
              {data.hasFinancing && data.bruttomietrendite !== null
                ? formatPercent(data.bruttomietrendite)
                : 'k. A.'}
            </p>
            {!data.hasFinancing && (
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                Finanzierungsdaten fehlen
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
