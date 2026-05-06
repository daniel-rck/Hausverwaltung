import { useState } from 'react';
import { useProperty } from '../../hooks/useProperty';
import { EmptyState } from '../../components/shared/EmptyState';
import { Tabs, type TabItem } from '../../components/ui';
import { PageHeader } from '../../components/layout/PageHeader';
import { MaintenanceList } from './MaintenanceList';
import { RecurringTasks } from './RecurringTasks';
import { UpcomingDue } from './UpcomingDue';
import { CostBreakdown } from './CostBreakdown';

type Tab = 'overview' | 'due' | 'costs';

const TAB_ITEMS: TabItem<Tab>[] = [
  { id: 'overview', label: 'Übersicht / Neue Maßnahme' },
  { id: 'due', label: 'Fällige Aufgaben' },
  { id: 'costs', label: 'Kostenauswertung' },
];

export function InstandhaltungPage() {
  const { activeProperty, addProperty } = useProperty();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

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
        title="Instandhaltung"
        description="Reparaturen, wiederkehrende Wartungen und Kostenauswertungen."
        icon="🔧"
        accent="instandhaltung"
      />

      <Tabs
        items={TAB_ITEMS}
        value={activeTab}
        onChange={setActiveTab}
        accent="instandhaltung"
      />

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
