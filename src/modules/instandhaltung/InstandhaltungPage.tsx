import { useState } from 'react';
import { useProperty } from '../../hooks/useProperty';
import { EmptyState } from '../../components/shared/EmptyState';
import { MaintenanceList } from './MaintenanceList';
import { RecurringTasks } from './RecurringTasks';
import { UpcomingDue } from './UpcomingDue';
import { CostBreakdown } from './CostBreakdown';

type Tab = 'overview' | 'due' | 'costs';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Übersicht / Neue Maßnahme' },
  { key: 'due', label: 'Fällige Aufgaben' },
  { key: 'costs', label: 'Kostenauswertung' },
];

export function InstandhaltungPage() {
  const { activeProperty, addProperty } = useProperty();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

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
      <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-4">Instandhaltung</h1>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-4 border-b border-stone-200 dark:border-stone-700">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
              activeTab === tab.key
                ? 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700 border-b-white dark:border-b-stone-800 -mb-px'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'overview' && (
          <>
            <MaintenanceList />
            <RecurringTasks />
          </>
        )}

        {activeTab === 'due' && <UpcomingDue />}

        {activeTab === 'costs' && <CostBreakdown />}
      </div>
    </div>
  );
}
