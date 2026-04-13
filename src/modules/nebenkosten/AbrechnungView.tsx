import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { getDistributionShare } from '../../utils/calc';
import { formatEuro, formatArea, formatDate } from '../../utils/format';
import type {
  Occupancy,
  Unit,
  Cost,
  CostType,
  CostShare,
  CostCategory,
  LandlordInfo,
} from '../../db/schema';

interface AbrechnungViewProps {
  occupancy: Occupancy;
  year: number;
  propertyId: number;
  /** When true, removes no-print wrapper so it renders inside print batch */
  embedded?: boolean;
}

interface OccupancyWithUnit {
  occupancy: Occupancy;
  unit: Unit;
}

interface CostLine {
  costType: CostType;
  cost: Cost;
  share: number;
  distributionLabel: string;
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
  area: 'Fläche',
  persons: 'Personen',
  units: 'Einheiten',
  messdienst: 'Messdienst',
  direct: 'Direkt',
};

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

export function AbrechnungView({
  occupancy,
  year,
  propertyId,
  embedded = false,
}: AbrechnungViewProps) {
  const data = useLiveQuery(async () => {
    const [
      property,
      landlordSetting,
      messdienstSetting,
      unit,
      tenant,
      allCostTypes,
      allUnits,
    ] = await Promise.all([
      db.properties.get(propertyId),
      db.settings.get('landlord'),
      db.settings.get('messdienstName'),
      db.units.get(occupancy.unitId),
      db.tenants.get(occupancy.tenantId),
      db.costTypes.orderBy('sortOrder').toArray(),
      db.units.where('propertyId').equals(propertyId).toArray(),
    ]);

    if (!property || !unit) return null;

    const landlord = (landlordSetting?.value as LandlordInfo) ?? {
      name: '',
      address: '',
    };
    const messdienstName =
      (messdienstSetting?.value as string) ?? 'Messdienstleister';

    // Get all costs for this property+year
    const allCosts = await db.costs
      .where('propertyId')
      .equals(propertyId)
      .toArray()
      .then((cs) => cs.filter((c) => c.year === year));

    // Get all occupancies for the year across all units
    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;
    const allOccupancies: OccupancyWithUnit[] = [];

    for (const u of allUnits) {
      const occs = await db.occupancies
        .where('unitId')
        .equals(u.id!)
        .toArray();
      const active = occs.filter(
        (o) => o.from <= yearEnd && (o.to === null || o.to >= yearStart),
      );
      for (const o of active) {
        allOccupancies.push({ occupancy: o, unit: u });
      }
    }

    const currentOccWithUnit: OccupancyWithUnit = { occupancy, unit };

    // Get all cost shares
    const costIds = allCosts.map((c) => c.id!).filter(Boolean);
    const allShares: CostShare[] =
      costIds.length > 0
        ? (await db.costShares.toArray()).filter((s) =>
            costIds.includes(s.costId),
          )
        : [];

    // Calculate each cost line
    const costLines: CostLine[] = [];

    for (const costType of allCostTypes) {
      const cost = allCosts.find((c) => c.costTypeId === costType.id!);
      if (!cost || cost.totalAmount === 0) continue;

      let share = 0;
      let distributionLabel = DISTRIBUTION_LABELS[costType.distribution];

      if (
        costType.distribution === 'messdienst' ||
        costType.distribution === 'direct'
      ) {
        const costShare = allShares.find(
          (s) => s.costId === cost.id! && s.occupancyId === occupancy.id!,
        );
        share = costShare?.amount ?? 0;
        distributionLabel =
          costType.distribution === 'messdienst'
            ? `lt. ${messdienstName}`
            : 'Direktzuordnung';
      } else {
        const fraction = getDistributionShare(
          costType.distribution,
          currentOccWithUnit,
          allOccupancies,
          year,
        );
        share = cost.totalAmount * fraction;
        distributionLabel = `${DISTRIBUTION_LABELS[costType.distribution]} (${(fraction * 100).toFixed(1)}%)`;
      }

      costLines.push({ costType, cost, share, distributionLabel });
    }

    // Get prepayment
    const prepayment = await db.prepayments
      .where('[occupancyId+year]')
      .equals([occupancy.id!, year])
      .first();

    const months = getOccupiedMonths(occupancy, year);
    const prepaymentAmount =
      prepayment?.amount ?? occupancy.rentUtilities * months;

    const totalCostShare = costLines.reduce((sum, l) => sum + l.share, 0);
    const result = totalCostShare - prepaymentAmount;

    return {
      property,
      landlord,
      unit,
      tenant,
      costLines,
      totalCostShare,
      prepaymentAmount,
      result,
      months,
    };
  }, [occupancy, year, propertyId]);

  if (!data) {
    return (
      <div className="text-center py-8 text-sm text-stone-500">
        Lade Abrechnung...
      </div>
    );
  }

  const {
    property,
    landlord,
    unit,
    tenant,
    costLines,
    totalCostShare,
    prepaymentAmount,
    result,
    months,
  } = data;

  // Group cost lines by category
  const grouped: Record<CostCategory, CostLine[]> = {
    tax: [],
    water: [],
    heating: [],
    insurance: [],
    cleaning: [],
    misc: [],
  };
  for (const line of costLines) {
    grouped[line.costType.category].push(line);
  }

  const today = new Date().toISOString().slice(0, 10);

  const content = (
    <div className="bg-white max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        {landlord.name && (
          <div className="text-sm text-stone-600 mb-4">
            <p className="font-semibold">{landlord.name}</p>
            <p className="whitespace-pre-line">{landlord.address}</p>
            {landlord.taxId && <p>St.-Nr.: {landlord.taxId}</p>}
          </div>
        )}

        <div className="text-sm text-stone-600 mb-4">
          <p>
            {tenant?.name ?? '\u2013'} | {unit.name},{' '}
            {property.address}
          </p>
        </div>

        <h2 className="text-lg font-bold text-stone-800">
          Betriebskostenabrechnung {year}
        </h2>
        <p className="text-sm text-stone-500">
          Objekt: {property.name}, {property.address}
        </p>
        <p className="text-sm text-stone-500">
          Wohnung: {unit.name} ({formatArea(unit.area)}) |{' '}
          Abrechnungszeitraum: {months} Monate
        </p>
      </div>

      {/* Cost table */}
      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="border-b-2 border-stone-300">
            <th className="py-2 text-left font-semibold text-stone-700">
              Kostenart
            </th>
            <th className="py-2 text-right font-semibold text-stone-700">
              Gesamtkosten
            </th>
            <th className="py-2 text-left font-semibold text-stone-700 pl-4">
              Verteilung
            </th>
            <th className="py-2 text-right font-semibold text-stone-700">
              Ihr Anteil
            </th>
          </tr>
        </thead>
        {CATEGORY_ORDER.map((cat) => {
            const lines = grouped[cat];
            if (lines.length === 0) return null;

            const catSubtotal = lines.reduce((s, l) => s + l.share, 0);

            return (
              <tbody key={cat}>
                <tr>
                  <td
                    colSpan={4}
                    className="pt-3 pb-1 text-xs font-semibold text-stone-500 uppercase tracking-wide"
                  >
                    {CATEGORY_LABELS[cat]}
                  </td>
                </tr>
                {lines.map((line) => (
                  <tr
                    key={line.costType.id}
                    className="border-b border-stone-100"
                  >
                    <td className="py-1.5 text-stone-700">
                      {line.costType.name}
                    </td>
                    <td className="py-1.5 text-right font-mono font-tabular text-stone-600">
                      {formatEuro(line.cost.totalAmount)}
                    </td>
                    <td className="py-1.5 pl-4 text-stone-500 text-xs">
                      {line.distributionLabel}
                    </td>
                    <td className="py-1.5 text-right font-mono font-tabular text-stone-800">
                      {formatEuro(line.share)}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-stone-200">
                  <td
                    colSpan={3}
                    className="py-1.5 text-xs font-medium text-stone-500 text-right pr-4"
                  >
                    Zwischensumme {CATEGORY_LABELS[cat]}
                  </td>
                  <td className="py-1.5 text-right font-mono font-tabular font-medium text-stone-700">
                    {formatEuro(catSubtotal)}
                  </td>
                </tr>
              </tbody>
            );
          })}
      </table>

      {/* Summary */}
      <div className="border-t-2 border-stone-300 pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-stone-700">
            Summe Betriebskosten
          </span>
          <span className="font-mono font-tabular font-semibold text-stone-800">
            {formatEuro(totalCostShare)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-stone-600">
            abzgl. Vorauszahlungen ({months} Monate)
          </span>
          <span className="font-mono font-tabular text-stone-600">
            - {formatEuro(prepaymentAmount)}
          </span>
        </div>
        <div className="flex justify-between text-base pt-2 border-t border-stone-200">
          <span className="font-bold text-stone-800">
            {result >= 0 ? 'Nachzahlung' : 'Guthaben'}
          </span>
          <span
            className={`font-mono font-tabular font-bold ${
              result >= 0 ? 'text-red-700' : 'text-green-700'
            }`}
          >
            {formatEuro(Math.abs(result))}
          </span>
        </div>
      </div>

      {/* Payment info */}
      {result > 0 && landlord.iban && (
        <div className="mt-4 p-3 bg-stone-50 rounded-lg text-xs text-stone-600">
          <p>
            Bitte \u00FCberweisen Sie den Betrag von{' '}
            <strong>{formatEuro(result)}</strong> auf folgendes Konto:
          </p>
          <p className="mt-1 font-mono">IBAN: {landlord.iban}</p>
          <p>Verwendungszweck: NK-Abrechnung {year} {unit.name}</p>
        </div>
      )}

      {result < 0 && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg text-xs text-green-800">
          <p>
            Ihr Guthaben von <strong>{formatEuro(Math.abs(result))}</strong>{' '}
            wird mit der n\u00E4chsten Mietzahlung verrechnet oder auf Ihr
            Konto \u00FCberwiesen.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-stone-200 text-xs text-stone-500">
        <p>Druckdatum: {formatDate(today)}</p>
        <div className="mt-8 flex justify-between">
          <div className="text-center">
            <div className="w-48 border-t border-stone-400 pt-1">
              Ort, Datum
            </div>
          </div>
          <div className="text-center">
            <div className="w-48 border-t border-stone-400 pt-1">
              Unterschrift Vermieter
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return <div className="print-container">{content}</div>;
}
