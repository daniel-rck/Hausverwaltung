import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { CostEntry } from './CostEntry';
import { MessdienstInput } from './MessdienstInput';
import { PrepaymentInput } from './PrepaymentInput';
import { AbrechnungView } from './AbrechnungView';
import { AbrechnungPrint } from './AbrechnungPrint';
import type { Occupancy, Tenant, Unit } from '../../db/schema';

type Tab = 'kosten' | 'messdienst' | 'vorauszahlung' | 'abrechnung';

interface OccupancyInfo {
  occupancy: Occupancy;
  tenant: Tenant | null;
  unit: Unit;
}

const TAB_LABELS: Record<Tab, string> = {
  kosten: 'Kosten erfassen',
  messdienst: 'Messdienst',
  vorauszahlung: 'Vorauszahlungen',
  abrechnung: 'Abrechnung anzeigen',
};

export function NebenkostenPage() {
  const { activeProperty, addProperty } = useProperty();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear - 1);
  const [activeTab, setActiveTab] = useState<Tab>('kosten');
  const [selectedOccupancyId, setSelectedOccupancyId] = useState<number | null>(
    null,
  );
  const [showPrintAll, setShowPrintAll] = useState(false);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  const occupancies = useLiveQuery(async () => {
    if (!activeProperty?.id) return [];

    const units = await db.units
      .where('propertyId')
      .equals(activeProperty.id)
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
  }, [activeProperty?.id, year]);

  if (!activeProperty) {
    return (
      <EmptyState
        icon="🏠"
        title="Kein Objekt vorhanden"
        description="Legen Sie zuerst ein Mietobjekt an."
        action={{
          label: 'Objekt anlegen',
          onClick: () =>
            addProperty({ name: 'Mein Haus', address: '', units: 0 }),
        }}
      />
    );
  }

  // Print all view
  if (showPrintAll) {
    return (
      <AbrechnungPrint
        propertyId={activeProperty.id!}
        year={year}
        onBack={() => setShowPrintAll(false)}
      />
    );
  }

  const selectedOccupancy = occupancies?.find(
    (o) => o.occupancy.id === selectedOccupancyId,
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-4">
        Nebenkostenabrechnung
      </h1>

      {/* Year selector and controls */}
      <div className="no-print flex flex-wrap items-center gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
            Abrechnungsjahr
          </label>
          <select
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setSelectedOccupancyId(null);
            }}
            className="border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-stone-500 dark:text-stone-400 self-end pb-1">
          {activeProperty.name}
          {activeProperty.address && ` – ${activeProperty.address}`}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="no-print flex border-b border-stone-200 dark:border-stone-700 mb-4 overflow-x-auto">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab !== 'abrechnung') {
                setSelectedOccupancyId(null);
              }
            }}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:border-stone-300'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'kosten' && (
        <CostEntry propertyId={activeProperty.id!} year={year} />
      )}

      {activeTab === 'messdienst' && (
        <MessdienstInput propertyId={activeProperty.id!} year={year} />
      )}

      {activeTab === 'vorauszahlung' && (
        <PrepaymentInput propertyId={activeProperty.id!} year={year} />
      )}

      {activeTab === 'abrechnung' && (
        <div className="space-y-4">
          {/* Occupancy selector */}
          <Card>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                  Mieter auswählen
                </label>
                <select
                  value={selectedOccupancyId ?? ''}
                  onChange={(e) =>
                    setSelectedOccupancyId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
                >
                  <option value="">Bitte wählen...</option>
                  {occupancies?.map((info) => (
                    <option key={info.occupancy.id} value={info.occupancy.id}>
                      {info.unit.name} –{' '}
                      {info.tenant?.name ?? 'Unbekannt'}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowPrintAll(true)}
                className="px-4 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors"
              >
                Alle drucken
              </button>
              {selectedOccupancyId && (
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                >
                  Diese Abrechnung drucken
                </button>
              )}
            </div>
          </Card>

          {/* Billing view */}
          {selectedOccupancy ? (
            <Card>
              <AbrechnungView
                occupancy={selectedOccupancy.occupancy}
                year={year}
                propertyId={activeProperty.id!}
              />
            </Card>
          ) : (
            <Card>
              {!occupancies || occupancies.length === 0 ? (
                <EmptyState
                  icon="👤"
                  title="Keine Belegungen"
                  description={`Keine aktiven Belegungen im Jahr ${year} gefunden. Legen Sie zuerst Wohnungen und Mieter an.`}
                />
              ) : (
                <EmptyState
                  icon="📋"
                  title="Mieter auswählen"
                  description="Wählen Sie einen Mieter aus, um die Abrechnung anzuzeigen."
                />
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
