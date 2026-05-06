import { useState } from 'react';
import { useProperty } from '../../hooks/useProperty';
import { EmptyState } from '../../components/shared/EmptyState';
import { Tabs, type TabItem } from '../../components/ui';
import { PageHeader } from '../../components/layout/PageHeader';
import { MeterList } from './MeterList';
import { ReadingForm } from './ReadingForm';
import { ConsumptionChart } from './ConsumptionChart';
import { CalibrationAlerts } from './CalibrationAlerts';

type Tab = 'meters' | 'readings' | 'calibration';

const TAB_ITEMS: TabItem<Tab>[] = [
  { id: 'meters', label: 'Zähler-Übersicht' },
  { id: 'readings', label: 'Ablesungen' },
  { id: 'calibration', label: 'Eichfristen' },
];

export function ZaehlerPage() {
  const { activeProperty, addProperty } = useProperty();
  const [activeTab, setActiveTab] = useState<Tab>('meters');
  const [selectedMeterId, setSelectedMeterId] = useState<number | null>(null);

  if (!activeProperty) {
    return (
      <EmptyState
        icon="🏠"
        title="Kein Objekt vorhanden"
        description="Lege zuerst ein Mietobjekt an."
        action={{
          label: 'Objekt anlegen',
          onClick: () => addProperty({ name: 'Mein Haus', address: '', units: 0 }),
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Zählerstand-Erfassung"
        description="Zähler erfassen, Ablesungen pflegen und Eichfristen im Blick behalten."
        icon="🔢"
        accent="zaehler"
      />

      <Tabs items={TAB_ITEMS} value={activeTab} onChange={setActiveTab} accent="zaehler" />

      {activeTab === 'meters' && <MeterList />}

      {activeTab === 'readings' && (
        <div className="space-y-4">
          <ReadingForm selectedMeterId={selectedMeterId} onMeterChange={setSelectedMeterId} />
          <ConsumptionChart meterId={selectedMeterId} />
        </div>
      )}

      {activeTab === 'calibration' && <CalibrationAlerts />}
    </div>
  );
}
