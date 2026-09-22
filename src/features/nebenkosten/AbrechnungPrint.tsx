import { db, useLiveQuery } from "../../lib/db";
import type { Occupancy, Tenant, Unit } from "../../lib/db/schema";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { Button, Skeleton } from "../../lib/ui/ui";
import { ChevronLeft, Printer, Receipt } from "../../lib/ui/ui/icons";
import { AbrechnungView } from "./AbrechnungView";

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

export function AbrechnungPrint({ propertyId, year, onBack }: AbrechnungPrintProps) {
  const occupancies = useLiveQuery(async () => {
    const units = await db.units.where("propertyId").equals(propertyId).toArray();

    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;
    const result: OccupancyInfo[] = [];

    for (const unit of units) {
      if (unit.id == null) continue;
      const occs = await db.occupancies.where("unitId").equals(unit.id).toArray();

      const active = occs.filter((o) => o.from <= yearEnd && (o.to === null || o.to >= yearStart));

      for (const occ of active) {
        const tenant = (await db.tenants.get(occ.tenantId)) ?? null;
        result.push({ occupancy: occ, tenant, unit });
      }
    }

    return result;
  }, [propertyId, year]);

  if (!occupancies) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton variant="text" width="30%" />
        <Skeleton height="20rem" />
      </div>
    );
  }

  if (occupancies.length === 0) {
    return (
      <EmptyState
        icon={<Receipt size={24} strokeWidth={1.75} />}
        title="Keine Belegungen"
        description={`Keine aktiven Belegungen im Jahr ${year} gefunden.`}
      />
    );
  }

  return (
    <div>
      {/* Controls - hidden when printing */}
      <div className="no-print mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" leftIcon={<ChevronLeft size={14} />} onClick={onBack}>
          Zurück
        </Button>
        <Button variant="primary" leftIcon={<Printer size={14} />} onClick={() => window.print()}>
          Alle drucken ({occupancies.length} Abrechnungen)
        </Button>
      </div>

      {/* Render each billing view with page breaks */}
      <div className="print-container">
        {occupancies.map((info, idx) => (
          <div key={info.occupancy.id} className={idx > 0 ? "page-break" : ""}>
            <div className="no-print mb-2 px-2">
              <p className="text-xs text-fg-subtle">
                Abrechnung {idx + 1} von {occupancies.length}: {info.tenant?.name ?? "–"} (
                {info.unit.name})
              </p>
            </div>
            <div className="border border-border rounded-lg p-6 mb-6 print:border-0 print:p-0 print:mb-0 print:rounded-none">
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
