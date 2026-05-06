import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { Button, FormField, Select, Tabs, type TabItem } from '../../components/ui';
import { PageHeader } from '../../components/layout/PageHeader';
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

const TAB_ITEMS: TabItem<Tab>[] = [
  { id: 'kosten', label: 'Kosten erfassen' },
  { id: 'messdienst', label: 'Messdienst' },
  { id: 'vorauszahlung', label: 'Vorauszahlungen' },
  { id: 'abrechnung', label: 'Abrechnung anzeigen' },
];

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
        description="Lege zuerst ein Mietobjekt an."
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
    <div className="space-y-4">
      <PageHeader
        title="Nebenkostenabrechnung"
        description={`${activeProperty.name}${activeProperty.address ? ` – ${activeProperty.address}` : ''}`}
        icon="📋"
        accent="nebenkosten"
        actions={
          <div className="no-print">
            <FormField label="Abrechnungsjahr">
              <Select
                value={year}
                onChange={(e) => {
                  setYear(Number(e.target.value));
                  setSelectedOccupancyId(null);
                }}
                className="!h-9 max-w-[140px]"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        }
      />

      <div className="no-print">
        <Tabs
          items={TAB_ITEMS}
          value={activeTab}
          accent="nebenkosten"
          ariaLabel="Nebenkosten-Bereiche"
          onChange={(id) => {
            setActiveTab(id);
            if (id !== 'abrechnung') setSelectedOccupancyId(null);
          }}
        />
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
                <FormField label="Mieter auswählen">
                  <Select
                    value={selectedOccupancyId ?? ''}
                    onChange={(e) =>
                      setSelectedOccupancyId(
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  >
                    <option value="">Bitte wählen…</option>
                    {occupancies?.map((info) => (
                      <option key={info.occupancy.id} value={info.occupancy.id}>
                        {info.unit.name} – {info.tenant?.name ?? 'Unbekannt'}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <Button variant="primary" accent="nebenkosten" onClick={() => setShowPrintAll(true)}>
                Alle drucken
              </Button>
              {selectedOccupancyId && (
                <Button variant="secondary" onClick={() => window.print()}>
                  Diese Abrechnung drucken
                </Button>
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
