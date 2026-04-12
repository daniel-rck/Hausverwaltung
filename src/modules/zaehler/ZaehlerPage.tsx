import { useState } from 'react';
import { useProperty } from '../../hooks/useProperty';
import { EmptyState } from '../../components/shared/EmptyState';
import { MeterList } from './MeterList';
import { ReadingForm } from './ReadingForm';
import { ConsumptionChart } from './ConsumptionChart';
import { CalibrationAlerts } from './CalibrationAlerts';

type Tab = 'meters' | 'readings' | 'calibration';

const TABS: { key: Tab; label: string }[] = [
  { key: 'meters', label: 'Zähler-Übersicht' },
  { key: 'readings', label: 'Ablesungen' },
  { key: 'calibration', label: 'Eichfristen' },
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
        description="Legen Sie zuerst ein Mietobjekt an."
        action={{
          label: 'Objekt anlegen',
          onClick: () => addProperty({ name: 'Mein Haus', address: '', units: 0 }),
        }}
      />
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-4">
        Zählerstand-Erfassung
      </h1>

      <div className="flex gap-1 mb-4 border-b border-stone-200 dark:border-stone-700">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-stone-800 dark:text-stone-100'
                : 'text-stone-400 dark:text-stone-500 hover:text-stone-600'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-800 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'meters' && <MeterList />}

      {activeTab === 'readings' && (
        <div className="space-y-4">
          <ReadingForm
            selectedMeterId={selectedMeterId}
            onMeterChange={setSelectedMeterId}
          />
          <ConsumptionChart meterId={selectedMeterId} />
        </div>
      )}

      {activeTab === 'calibration' && <CalibrationAlerts />}
    </div>
  );
}
