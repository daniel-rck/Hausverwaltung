import { useState } from "react";
import { useProperty } from "../../lib/hooks/useProperty";
import { PageHeader } from "../../lib/ui/layout/PageHeader";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { type TabItem, Tabs } from "../../lib/ui/ui";
import { Building2, Gauge } from "../../lib/ui/ui/icons";
import { CalibrationAlerts } from "./CalibrationAlerts";
import { ConsumptionChart } from "./ConsumptionChart";
import { MeterList } from "./MeterList";
import { ReadingBatchForm } from "./ReadingBatchForm";
import { ReadingForm } from "./ReadingForm";

type Tab = "meters" | "readings" | "calibration";
type EntryMode = "single" | "batch";

const TAB_ITEMS: TabItem<Tab>[] = [
  { id: "meters", label: "Zähler-Übersicht" },
  { id: "readings", label: "Ablesungen" },
  { id: "calibration", label: "Eichfristen" },
];

const ENTRY_MODE_ITEMS: TabItem<EntryMode>[] = [
  { id: "single", label: "Einzelerfassung" },
  { id: "batch", label: "Batch-Erfassung" },
];

export function ZaehlerPage() {
  const { activeProperty, addProperty } = useProperty();
  const [activeTab, setActiveTab] = useState<Tab>("meters");
  const [entryMode, setEntryMode] = useState<EntryMode>("single");
  const [selectedMeterId, setSelectedMeterId] = useState<number | null>(null);

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
        title="Zählerstand-Erfassung"
        description="Zähler erfassen, Ablesungen pflegen und Eichfristen im Blick behalten."
        icon={<Gauge size={20} strokeWidth={1.75} />}
        accent="zaehler"
      />

      <Tabs items={TAB_ITEMS} value={activeTab} onChange={setActiveTab} accent="zaehler" />

      {activeTab === "meters" && <MeterList />}

      {activeTab === "readings" && (
        <div className="space-y-4">
          <Tabs
            items={ENTRY_MODE_ITEMS}
            value={entryMode}
            onChange={setEntryMode}
            accent="zaehler"
            ariaLabel="Erfassungsmodus"
          />
          {entryMode === "single" ? (
            <ReadingForm selectedMeterId={selectedMeterId} onMeterChange={setSelectedMeterId} />
          ) : (
            <ReadingBatchForm
              selectedMeterId={selectedMeterId}
              onMeterChange={setSelectedMeterId}
            />
          )}
          <ConsumptionChart meterId={selectedMeterId} />
        </div>
      )}

      {activeTab === "calibration" && <CalibrationAlerts />}
    </div>
  );
}
