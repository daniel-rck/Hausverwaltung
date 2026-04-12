import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { AbrechnungView } from './AbrechnungView';
import { EmptyState } from '../../components/shared/EmptyState';
import type { Occupancy, Tenant, Unit } from '../../db/schema';

interface AbrechnungPrintProps {
  propertyId: number;
  year: number;
  onBack: () => void;
}

interface OccupancyInfo {
  occupancy: Occupancy;
  tenant: Tenant | null;
  unit: Unit;
}

export function AbrechnungPrint({
  propertyId,
  year,
  onBack,
}: AbrechnungPrintProps) {
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

  if (!occupancies) {
    return (
      <div className="text-center py-8 text-sm text-stone-500">
        Lade Abrechnungen...
      </div>
    );
  }

  if (occupancies.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="Keine Belegungen"
        description={`Keine aktiven Belegungen im Jahr ${year} gefunden.`}
      />
    );
  }

  return (
    <div>
      {/* Controls - hidden when printing */}
      <div className="no-print mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1"
        >
          \u2190 Zur\u00FCck
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors"
        >
          Alle drucken ({occupancies.length} Abrechnungen)
        </button>
      </div>

      {/* Render each billing view with page breaks */}
      <div className="print-container">
        {occupancies.map((info, idx) => (
          <div
            key={info.occupancy.id}
            className={idx > 0 ? 'page-break' : ''}
          >
            <div className="no-print mb-2 px-2">
              <p className="text-xs text-stone-400">
                Abrechnung {idx + 1} von {occupancies.length}:{' '}
                {info.tenant?.name ?? '\u2013'} ({info.unit.name})
              </p>
            </div>
            <div className="border border-stone-200 rounded-xl p-6 mb-6 print:border-0 print:p-0 print:mb-0 print:rounded-none">
              <AbrechnungView
                occupancy={info.occupancy}
                year={year}
                propertyId={propertyId}
                embedded
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
