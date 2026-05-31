import { useState } from "react";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { type TabItem, Tabs } from "../../components/ui";
import { Building2, Gauge } from "../../components/ui/icons";
import { useProperty } from "../../hooks/useProperty";
import { CalibrationAlerts } from "./CalibrationAlerts";
import { ConsumptionChart } from "./ConsumptionChart";
import { MeterList } from "./MeterList";
import { ReadingForm } from "./ReadingForm";

type Tab = "meters" | "readings" | "calibration";

const TAB_ITEMS: TabItem<Tab>[] = [
  { id: "meters", label: "Zähler-Übersicht" },
  { id: "readings", label: "Ablesungen" },
  { id: "calibration", label: "Eichfristen" },
];

export function ZaehlerPage() {
  const { activeProperty, addProperty } = useProperty();
  const [activeTab, setActiveTab] = useState<Tab>("meters");
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
          <ReadingForm selectedMeterId={selectedMeterId} onMeterChange={setSelectedMeterId} />
          <ConsumptionChart meterId={selectedMeterId} />
        </div>
      )}

      {activeTab === "calibration" && <CalibrationAlerts />}
    </div>
  );
}
