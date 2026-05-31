import { useState } from "react";
import { useProperty } from "../../lib/hooks/useProperty";
import { PageHeader } from "../../lib/ui/layout/PageHeader";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { type TabItem, Tabs } from "../../lib/ui/ui";
import { Building2, Wrench } from "../../lib/ui/ui/icons";
import { CostBreakdown } from "./CostBreakdown";
import { MaintenanceList } from "./MaintenanceList";
import { RecurringTasks } from "./RecurringTasks";
import { UpcomingDue } from "./UpcomingDue";

type Tab = "overview" | "due" | "costs";

const TAB_ITEMS: TabItem<Tab>[] = [
  { id: "overview", label: "Übersicht / Neue Maßnahme" },
  { id: "due", label: "Fällige Aufgaben" },
  { id: "costs", label: "Kostenauswertung" },
];

export function InstandhaltungPage() {
  const { activeProperty, addProperty } = useProperty();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  if (!activeProperty) {
    return (
      <EmptyState
        icon={<Building2 size={24} strokeWidth={1.75} />}
        title="Kein Objekt vorhanden"
        description="Lege zuerst ein Mietobjekt an."
        action={{
          label: "Objekt anlegen",
          onClick: () => addProperty({ name: "Mein Haus", address: "", units: 0 }),
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Instandhaltung"
        description="Reparaturen, wiederkehrende Wartungen und Kostenauswertungen."
        icon={<Wrench size={20} strokeWidth={1.75} />}
        accent="instandhaltung"
      />

      <Tabs items={TAB_ITEMS} value={activeTab} onChange={setActiveTab} accent="instandhaltung" />

      <div className="space-y-4">
        {activeTab === "overview" && (
          <>
            <MaintenanceList />
            <RecurringTasks />
          </>
        )}
        {activeTab === "due" && <UpcomingDue />}
        {activeTab === "costs" && <CostBreakdown />}
      </div>
    </div>
  );
}
