import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { usePrint } from '../../hooks/usePrint';
import { Card } from '../../components/shared/Card';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatEuro, formatMonth, formatDate } from '../../utils/format';
import type { Occupancy, Unit, Tenant, Payment, LandlordInfo } from '../../db/schema';

type Mahnstufe = 1 | 2 | 3;

interface PaymentReminderProps {
  year: number;
}

interface OverdueMonth {
  month: string;
  expected: number;
  received: number;
  difference: number;
}

interface OpenTenantItem {
  id: string;
  unit: Unit;
  tenant: Tenant;
  occupancy: Occupancy;
  overdueMonths: OverdueMonth[];
  totalDifference: number;
}

interface LetterData {
  item: OpenTenantItem;
  mahnstufe: Mahnstufe;
}

const MAHNSTUFE_OPTIONS: { value: Mahnstufe; label: string; status: 'yellow' | 'red' | 'red' }[] = [
  { value: 1, label: '1. Erinnerung', status: 'yellow' },
  { value: 2, label: '2. Mahnung', status: 'red' },
  { value: 3, label: '3. Letzte Mahnung', status: 'red' },
];

function getMahnSubject(stufe: Mahnstufe): string {
  switch (stufe) {
    case 1:
      return `Freundliche Zahlungserinnerung`;
    case 2:
      return `Mahnung - Ausstehende Mietzahlungen`;
    case 3:
      return `Letzte Mahnung vor rechtlichen Schritten`;
  }
}

function getMahnAnrede(tenantName: string): string {
  return `Sehr geehrte/r ${tenantName}`;
}

function getMahnText(stufe: Mahnstufe, totalAmount: string, deadline: string): string {
  switch (stufe) {
    case 1:
      return (
        `bei der Durchsicht unserer Unterlagen ist uns aufgefallen, dass die unten aufgeführten ` +
        `Mietzahlungen noch nicht bei uns eingegangen sind. Sicherlich handelt es sich um ein Versehen.\n\n` +
        `Wir bitten Sie freundlich, den ausstehenden Gesamtbetrag von ${totalAmount} ` +
        `bis zum ${deadline} auf das unten genannte Konto zu überweisen.\n\n` +
        `Sollte sich Ihre Zahlung mit diesem Schreiben gekreuzt haben, betrachten Sie diese ` +
        `Erinnerung bitte als gegenstandslos.`
      );
    case 2:
      return (
        `trotz unserer Zahlungserinnerung mussten wir feststellen, dass die unten aufgeführten ` +
        `Mietzahlungen weiterhin ausstehen.\n\n` +
        `Wir fordern Sie hiermit auf, den Gesamtbetrag von ${totalAmount} ` +
        `unverzüglich, spätestens jedoch bis zum ${deadline}, auf das unten genannte Konto zu überweisen.\n\n` +
        `Bitte beachten Sie, dass wir bei weiterem Zahlungsverzug gezwungen sind, ` +
        `weitere Maßnahmen einzuleiten.`
      );
    case 3:
      return (
        `trotz wiederholter Aufforderung sind die unten aufgeführten Mietzahlungen ` +
        `nach wie vor nicht bei uns eingegangen.\n\n` +
        `Wir setzen Ihnen hiermit eine letzte Frist bis zum ${deadline} zur Zahlung des ` +
        `Gesamtbetrags von ${totalAmount}.\n\n` +
        `Sollte die Zahlung bis zu diesem Datum nicht vollständig eingegangen sein, sehen wir ` +
        `uns gezwungen, ohne weitere Ankündigung rechtliche Schritte einzuleiten und gegebenenfalls ` +
        `das Mietverhältnis fristlos zu kündigen. Die dadurch entstehenden Kosten gehen zu Ihren Lasten.`
      );
  }
}

function getDeadline(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function PaymentReminder({ year }: PaymentReminderProps) {
  const { activeProperty } = useProperty();
  const { isPrinting, print } = usePrint();
  const [activeLetter, setActiveLetter] = useState<LetterData | null>(null);
  const [selectedStufe, setSelectedStufe] = useState<Mahnstufe>(1);

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
      tenants.filter(Boolean).map((t) => [t!.id!, t!]),
    );

    const unitMap = new Map(units.map((u) => [u.id!, u]));

    const allPayments = await db.payments.toArray();
    const paymentMap = new Map<string, Payment>();
    for (const p of allPayments) {
      paymentMap.set(`${p.occupancyId}-${p.month}`, p);
    }

    const landlordSetting = await db.settings.get('landlord');
    const landlord = (landlordSetting?.value as LandlordInfo) ?? {
      name: '',
      address: '',
      iban: '',
      taxId: '',
    };

    return { occupancies, unitMap, tenantMap, paymentMap, landlord };
  }, [activeProperty?.id]);

  const items = useMemo((): OpenTenantItem[] => {
    if (!data) return [];

    const { occupancies, unitMap, tenantMap, paymentMap } = data;
    const result: OpenTenantItem[] = [];

    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;

    const now = new Date();
    const currentMonth =
      now.getFullYear() === year
        ? `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`
        : yearEnd;

    for (const occ of occupancies) {
      if (occ.from > yearEnd || (occ.to !== null && occ.to < yearStart))
        continue;

      const unit = unitMap.get(occ.unitId);
      const tenant = tenantMap.get(occ.tenantId);
      if (!unit || !tenant) continue;

      const overdueMonths: OverdueMonth[] = [];

      for (let m = 1; m <= 12; m++) {
        const month = `${year}-${String(m).padStart(2, '0')}`;
        if (month > currentMonth) break;
        if (month < occ.from) continue;
        if (occ.to !== null && month > occ.to) continue;

        const expected = occ.rentCold + occ.rentUtilities;
        const payment = paymentMap.get(`${occ.id}-${month}`);
        const received = payment
          ? payment.amountCold + payment.amountUtilities
          : 0;

        if (received < expected) {
          overdueMonths.push({
            month,
            expected,
            received,
            difference: expected - received,
          });
        }
      }

      if (overdueMonths.length > 0) {
        const totalDifference = overdueMonths.reduce(
          (sum, om) => sum + om.difference,
          0,
        );
        result.push({
          id: `${occ.id}`,
          unit,
          tenant,
          occupancy: occ,
          overdueMonths,
          totalDifference,
        });
      }
    }

    result.sort((a, b) => b.totalDifference - a.totalDifference);
    return result;
  }, [data, year]);

  const openLetter = (item: OpenTenantItem) => {
    setActiveLetter({ item, mahnstufe: selectedStufe });
  };

  const closeLetter = () => {
    setActiveLetter(null);
  };

  if (!data) return null;

  const { landlord } = data;

  // ---------- Print-ready letter view ----------
  if (activeLetter) {
    const { item, mahnstufe } = activeLetter;
    const todayIso = getTodayIso();
    const deadlineIso = getDeadline();
    const totalFormatted = formatEuro(item.totalDifference);

    const letterContent = (
      <div className="print-container bg-white dark:bg-stone-800 max-w-3xl mx-auto p-8 print:p-0">
        {/* A4 letter layout */}
        <div className="min-h-[297mm] print:min-h-0 text-stone-800 dark:text-stone-100 print:text-black text-sm leading-relaxed">
          {/* Sender (small, above address window) */}
          {landlord.name && (
            <p className="text-xs text-stone-400 dark:text-stone-500 print:text-gray-500 mb-1 underline">
              {landlord.name} - {landlord.address.replace(/\n/g, ', ')}
            </p>
          )}

          {/* Recipient */}
          <div className="mb-10">
            <p className="font-medium">{item.tenant.name}</p>
            <p>{activeProperty?.address ?? ''}</p>
            <p>{item.unit.name}</p>
          </div>

          {/* Date, right-aligned */}
          <div className="text-right mb-8">
            <p>{formatDate(todayIso)}</p>
          </div>

          {/* Subject */}
          <p className="font-bold text-base mb-6">
            {getMahnSubject(mahnstufe)}
          </p>

          {/* Salutation and body */}
          <p className="mb-4">{getMahnAnrede(item.tenant.name)},</p>
          <p className="whitespace-pre-line mb-6">
            {getMahnText(mahnstufe, totalFormatted, formatDate(deadlineIso))}
          </p>

          {/* Overdue months table */}
          <div className="mb-6">
            <p className="font-semibold mb-2">Ausstehende Beträge:</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-stone-300 print:border-black">
                  <th className="py-2 px-3 text-left font-medium">Monat</th>
                  <th className="py-2 px-3 text-right font-medium">Sollbetrag</th>
                  <th className="py-2 px-3 text-right font-medium">Eingegangen</th>
                  <th className="py-2 px-3 text-right font-medium">Offen</th>
                </tr>
              </thead>
              <tbody>
                {item.overdueMonths.map((om) => (
                  <tr
                    key={om.month}
                    className="border-b border-stone-200 dark:border-stone-600 print:border-gray-300"
                  >
                    <td className="py-2 px-3">{formatMonth(om.month)}</td>
                    <td className="py-2 px-3 text-right font-mono">
                      {formatEuro(om.expected)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {formatEuro(om.received)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">
                      {formatEuro(om.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-300 print:border-black">
                  <td className="py-2 px-3 font-bold" colSpan={3}>
                    Gesamtbetrag
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold">
                    {totalFormatted}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payment details */}
          <div className="mb-6 p-4 bg-stone-50 dark:bg-stone-700 print:bg-gray-50 rounded-lg print:border print:border-gray-300">
            <p className="font-semibold mb-2">Zahlungsverbindung:</p>
            <p>Empfänger: {landlord.name || '–'}</p>
            {landlord.iban && (
              <p>IBAN: <span className="font-mono">{landlord.iban}</span></p>
            )}
            <p>
              Verwendungszweck: Miete {item.unit.name} - {item.tenant.name}
            </p>
            <p className="mt-2 font-semibold">
              Zahlungsfrist: {formatDate(deadlineIso)}
            </p>
          </div>

          {/* Closing */}
          <p className="mb-12">
            {mahnstufe === 1
              ? 'Für Rückfragen stehen wir Ihnen gerne zur Verfügung.'
              : mahnstufe === 2
                ? 'Wir erwarten Ihre umgehende Zahlung.'
                : 'Wir erwarten Ihre umgehende Zahlung und behalten uns alle weiteren rechtlichen Schritte vor.'}
          </p>

          <p className="mb-2">Mit freundlichen Grüßen</p>

          {/* Signature line */}
          <div className="mt-10">
            <div className="w-64 border-b border-stone-400 print:border-black mb-1" />
            <p className="text-xs text-stone-500 dark:text-stone-400 print:text-gray-600">
              {landlord.name || 'Vermieter/in'}
            </p>
          </div>
        </div>
      </div>
    );

    if (isPrinting) {
      return letterContent;
    }

    return (
      <div className="space-y-4">
        {/* Controls - hidden on print */}
        <div className="no-print flex items-center justify-between">
          <button
            onClick={closeLetter}
            className="px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors text-stone-700 dark:text-stone-200"
          >
            Zurück zur Übersicht
          </button>
          <div className="flex items-center gap-3">
            <select
              value={activeLetter.mahnstufe}
              onChange={(e) =>
                setActiveLetter({
                  ...activeLetter,
                  mahnstufe: Number(e.target.value) as Mahnstufe,
                })
              }
              className="border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
            >
              {MAHNSTUFE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={print}
              className="px-4 py-2 text-sm bg-stone-800 dark:bg-stone-600 text-white rounded-lg hover:bg-stone-900 dark:hover:bg-stone-500 transition-colors"
            >
              Drucken
            </button>
          </div>
        </div>

        {/* Letter preview */}
        <Card>
          {letterContent}
        </Card>
      </div>
    );
  }

  // ---------- List view ----------
  return (
    <Card
      title="Mahnwesen"
      action={
        items.length > 0 ? (
          <div className="no-print flex items-center gap-2">
            <select
              value={selectedStufe}
              onChange={(e) => setSelectedStufe(Number(e.target.value) as Mahnstufe)}
              className="border border-stone-300 dark:border-stone-600 rounded-lg px-2 py-1 text-xs bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
            >
              {MAHNSTUFE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Keine offenen Posten"
          description={`Alle Mietzahlungen für ${year} sind vollständig eingegangen. Keine Mahnungen erforderlich.`}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/40"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-stone-800 dark:text-stone-100 truncate">
                    {item.tenant.name}
                  </span>
                  <StatusBadge
                    status={item.overdueMonths.length >= 3 ? 'red' : 'yellow'}
                    label={`${item.overdueMonths.length} ${item.overdueMonths.length === 1 ? 'Monat' : 'Monate'} offen`}
                  />
                </div>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {item.unit.name} &middot; Offen:{' '}
                  <span className="font-mono font-medium text-red-600 dark:text-red-400">
                    {formatEuro(item.totalDifference)}
                  </span>
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  {item.overdueMonths.map((om) => formatMonth(om.month)).join(', ')}
                </p>
              </div>
              <button
                onClick={() => openLetter(item)}
                className="no-print ml-4 shrink-0 px-4 py-2 text-sm bg-stone-800 dark:bg-stone-600 text-white rounded-lg hover:bg-stone-900 dark:hover:bg-stone-500 transition-colors"
              >
                Mahnung erstellen
              </button>
            </div>
          ))}

          <div className="pt-3 border-t border-stone-200 dark:border-stone-700 flex justify-between text-sm">
            <span className="text-stone-600 dark:text-stone-300">
              {items.length} {items.length === 1 ? 'Mieter' : 'Mieter'} mit offenen Posten
            </span>
            <span className="font-mono font-semibold text-red-600 dark:text-red-400">
              Gesamt: {formatEuro(items.reduce((s, i) => s + i.totalDifference, 0))}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
