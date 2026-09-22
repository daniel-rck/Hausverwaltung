import { useMemo, useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { LandlordInfo, Occupancy, Payment, Tenant, Unit } from "../../lib/db/schema";
import { usePrint } from "../../lib/hooks/usePrint";
import { useProperty } from "../../lib/hooks/useProperty";
import { Card } from "../../lib/ui/shared/Card";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { StatusBadge } from "../../lib/ui/shared/StatusBadge";
import { Button, Select, Skeleton } from "../../lib/ui/ui";
import { CheckCircle2, Printer } from "../../lib/ui/ui/icons";
import { lastDueMonth } from "../../lib/utils/dates";
import { formatDate, formatEuro, formatMonth } from "../../lib/utils/format";
import { buildRentLookup } from "../../lib/utils/rent";

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

const MAHNSTUFE_OPTIONS: { value: Mahnstufe; label: string; status: "yellow" | "red" | "red" }[] = [
  { value: 1, label: "1. Erinnerung", status: "yellow" },
  { value: 2, label: "2. Mahnung", status: "red" },
  { value: 3, label: "3. Letzte Mahnung", status: "red" },
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
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function PaymentReminder({ year }: PaymentReminderProps) {
  const { activeProperty } = useProperty();
  const { isPrinting, print } = usePrint();
  const [activeLetter, setActiveLetter] = useState<LetterData | null>(null);
  const [selectedStufe, setSelectedStufe] = useState<Mahnstufe>(1);

  const data = useLiveQuery(async () => {
    if (!activeProperty?.id) return null;

    const units = await db.units.where("propertyId").equals(activeProperty.id).toArray();

    const unitIds = units.flatMap((u) => (u.id != null ? [u.id] : []));
    const allOccupancies = await db.occupancies.toArray();
    const occupancies = allOccupancies.filter((o) => unitIds.includes(o.unitId));

    const tenantIds = [...new Set(occupancies.map((o) => o.tenantId))];
    const tenants = await db.tenants.bulkGet(tenantIds);
    const tenantMap = new Map<number, Tenant>();
    for (const t of tenants) {
      if (t?.id != null) tenantMap.set(t.id, t);
    }

    const unitMap = new Map<number, Unit>();
    for (const u of units) {
      if (u.id != null) unitMap.set(u.id, u);
    }

    const allPayments = await db.payments.toArray();
    const paymentMap = new Map<string, Payment>();
    for (const p of allPayments) {
      paymentMap.set(`${p.occupancyId}-${p.month}`, p);
    }

    const landlordSetting = await db.settings.get("landlord");
    const landlord = (landlordSetting?.value as LandlordInfo) ?? {
      name: "",
      address: "",
      iban: "",
      taxId: "",
    };

    const rentChanges = await db.rentChanges.toArray();
    return { occupancies, unitMap, tenantMap, paymentMap, landlord, rentChanges };
  }, [activeProperty?.id]);

  const items = useMemo((): OpenTenantItem[] => {
    if (!data) return [];

    const { occupancies, unitMap, tenantMap, paymentMap, rentChanges } = data;
    const rentAt = buildRentLookup(rentChanges);
    const result: OpenTenantItem[] = [];

    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;

    // Nur bereits fällige Monate (laufender Monat erst ab dem 4.).
    const dueUntil = lastDueMonth();
    const currentMonth = dueUntil < yearEnd ? dueUntil : yearEnd;

    for (const occ of occupancies) {
      if (occ.from > yearEnd || (occ.to !== null && occ.to < yearStart)) continue;

      const unit = unitMap.get(occ.unitId);
      const tenant = tenantMap.get(occ.tenantId);
      if (!unit || !tenant) continue;

      const overdueMonths: OverdueMonth[] = [];

      for (let m = 1; m <= 12; m++) {
        const month = `${year}-${String(m).padStart(2, "0")}`;
        if (month > currentMonth) break;
        if (month < occ.from) continue;
        if (occ.to !== null && month > occ.to) continue;

        const expected = rentAt(occ, month) + occ.rentUtilities;
        const payment = paymentMap.get(`${occ.id}-${month}`);
        const received = payment ? payment.amountCold + payment.amountUtilities : 0;

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
        const totalDifference = overdueMonths.reduce((sum, om) => sum + om.difference, 0);
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

  if (data === undefined) {
    return (
      <Card title="Mahnwesen">
        <div className="space-y-3">
          <Skeleton height="4.5rem" />
          <Skeleton height="4.5rem" />
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const { landlord } = data;

  // ---------- Print-ready letter view ----------
  if (activeLetter) {
    const { item, mahnstufe } = activeLetter;
    const todayIso = getTodayIso();
    const deadlineIso = getDeadline();
    const totalFormatted = formatEuro(item.totalDifference);

    const letterContent = (
      <div className="print-container bg-white text-zinc-900 max-w-3xl mx-auto p-8 print:p-0 rounded-md border border-zinc-200 print:border-0">
        {/* A4 letter layout */}
        <div className="min-h-[297mm] print:min-h-0 text-zinc-900 print:text-black text-sm leading-relaxed">
          {/* Sender (small, above address window) */}
          {landlord.name && (
            <p className="text-xs text-zinc-500 mb-1 underline">
              {landlord.name} - {landlord.address.replace(/\n/g, ", ")}
            </p>
          )}

          {/* Recipient */}
          <div className="mb-10">
            <p className="font-medium">{item.tenant.name}</p>
            <p>{activeProperty?.address ?? ""}</p>
            <p>{item.unit.name}</p>
          </div>

          {/* Date, right-aligned */}
          <div className="text-right mb-8">
            <p>{formatDate(todayIso)}</p>
          </div>

          {/* Subject */}
          <p className="font-bold text-base mb-6">{getMahnSubject(mahnstufe)}</p>

          {/* Salutation and body */}
          <p className="mb-4">{getMahnAnrede(item.tenant.name)},</p>
          <p className="whitespace-pre-line mb-6">
            {getMahnText(mahnstufe, totalFormatted, formatDate(deadlineIso))}
          </p>

          {/* Overdue months table */}
          <div className="mb-6">
            <p className="font-semibold mb-2">Ausstehende Beträge:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-zinc-300 print:border-black">
                    <th className="py-2 px-3 text-left font-medium">Monat</th>
                    <th className="py-2 px-3 text-right font-medium">Sollbetrag</th>
                    <th className="py-2 px-3 text-right font-medium">Eingegangen</th>
                    <th className="py-2 px-3 text-right font-medium">Offen</th>
                  </tr>
                </thead>
                <tbody>
                  {item.overdueMonths.map((om) => (
                    <tr key={om.month} className="border-b border-zinc-200 print:border-zinc-300">
                      <td className="py-2 px-3">{formatMonth(om.month)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatEuro(om.expected)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatEuro(om.received)}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {formatEuro(om.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-300 print:border-black">
                    <td className="py-2 px-3 font-bold" colSpan={3}>
                      Gesamtbetrag
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{totalFormatted}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payment details */}
          <div className="mb-6 p-4 bg-zinc-50 rounded-lg border border-zinc-200 print:border-zinc-300">
            <p className="font-semibold mb-2">Zahlungsverbindung:</p>
            <p>Empfänger: {landlord.name || "–"}</p>
            {landlord.iban && (
              <p>
                IBAN: <span className="font-mono">{landlord.iban}</span>
              </p>
            )}
            <p>
              Verwendungszweck: Miete {item.unit.name} - {item.tenant.name}
            </p>
            <p className="mt-2 font-semibold">Zahlungsfrist: {formatDate(deadlineIso)}</p>
          </div>

          {/* Closing */}
          <p className="mb-12">
            {mahnstufe === 1
              ? "Für Rückfragen stehen wir Ihnen gerne zur Verfügung."
              : mahnstufe === 2
                ? "Wir erwarten Ihre umgehende Zahlung."
                : "Wir erwarten Ihre umgehende Zahlung und behalten uns alle weiteren rechtlichen Schritte vor."}
          </p>

          <p className="mb-2">Mit freundlichen Grüßen</p>

          {/* Signature line */}
          <div className="mt-10">
            <div className="w-64 border-b border-zinc-400 print:border-black mb-1" />
            <p className="text-xs text-zinc-600">{landlord.name || "Vermieter/in"}</p>
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
          <Button variant="secondary" onClick={closeLetter}>
            Zurück zur Übersicht
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-48">
              <Select
                aria-label="Mahnstufe"
                value={activeLetter.mahnstufe}
                onChange={(e) =>
                  setActiveLetter({
                    ...activeLetter,
                    mahnstufe: Number(e.target.value) as Mahnstufe,
                  })
                }
              >
                {MAHNSTUFE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="primary" onClick={print} leftIcon={<Printer size={14} />}>
              Drucken
            </Button>
          </div>
        </div>

        {/* Letter preview */}
        <Card>{letterContent}</Card>
      </div>
    );
  }

  // ---------- List view ----------
  return (
    <Card
      title="Mahnwesen"
      action={
        items.length > 0 ? (
          <div className="no-print w-44">
            <Select
              aria-label="Mahnstufe für neue Mahnungen"
              value={selectedStufe}
              onChange={(e) => setSelectedStufe(Number(e.target.value) as Mahnstufe)}
            >
              {MAHNSTUFE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={24} strokeWidth={1.75} />}
          title="Keine offenen Posten"
          description={`Alle Mietzahlungen für ${year} sind vollständig eingegangen. Keine Mahnungen erforderlich.`}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface-muted/40"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-fg truncate">{item.tenant.name}</span>
                  <StatusBadge
                    status={item.overdueMonths.length >= 3 ? "red" : "yellow"}
                    label={`${item.overdueMonths.length} ${item.overdueMonths.length === 1 ? "Monat" : "Monate"} offen`}
                  />
                </div>
                <p className="text-sm text-fg-muted">
                  {item.unit.name} &middot; Offen:{" "}
                  <span className="font-mono font-medium text-danger-fg">
                    {formatEuro(item.totalDifference)}
                  </span>
                </p>
                <p className="text-xs text-fg-subtle mt-0.5">
                  {item.overdueMonths.map((om) => formatMonth(om.month)).join(", ")}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => openLetter(item)}
                className="no-print ml-4 shrink-0"
              >
                Mahnung erstellen
              </Button>
            </div>
          ))}

          <div className="pt-3 border-t border-border flex justify-between text-sm">
            <span className="text-fg-muted">
              {items.length} {items.length === 1 ? "Mieter" : "Mieter"} mit offenen Posten
            </span>
            <span className="font-mono font-semibold text-danger-fg">
              Gesamt: {formatEuro(items.reduce((s, i) => s + i.totalDifference, 0))}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
