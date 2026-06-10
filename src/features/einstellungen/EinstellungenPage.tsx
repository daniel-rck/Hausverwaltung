import { useState } from "react";
import { db, useLiveQuery } from "../../lib/db";
import type { LandlordInfo } from "../../lib/db/schema";
import { PageHeader } from "../../lib/ui/layout/PageHeader";
import { Card } from "../../lib/ui/shared/Card";
import { SyncSettings } from "../../lib/ui/sync/SyncSettings";
import { Button, FormField, Input, type TabItem, Tabs, useToast } from "../../lib/ui/ui";
import { Settings } from "../../lib/ui/ui/icons";
import { ExportImport } from "../dashboard/ExportImport";

type Tab = "allgemein" | "sync" | "daten";

const tabItems: TabItem<Tab>[] = [
  { id: "allgemein", label: "Allgemein" },
  { id: "sync", label: "Sync" },
  { id: "daten", label: "Daten" },
];

export function EinstellungenPage() {
  const [tab, setTab] = useState<Tab>("allgemein");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Einstellungen"
        description="Vermieter-Daten, Sync & Datenverwaltung."
        icon={<Settings size={20} strokeWidth={1.75} />}
      >
        <Tabs items={tabItems} value={tab} onChange={setTab} ariaLabel="Einstellungen-Bereiche" />
      </PageHeader>

      {tab === "allgemein" && <AllgemeinTab />}
      {tab === "sync" && <SyncSettings />}
      {tab === "daten" && <ExportImport />}
    </div>
  );
}

function AllgemeinTab() {
  const landlord = useLiveQuery(async () => {
    const setting = await db.settings.get("landlord");
    return (setting?.value as LandlordInfo) ?? { name: "", address: "", iban: "", taxId: "" };
  });

  const messdienst = useLiveQuery(async () => {
    const setting = await db.settings.get("messdienstName");
    return (setting?.value as string) ?? "Messdienstleister";
  });

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<LandlordInfo>({ name: "", address: "", iban: "", taxId: "" });
  const [messdienstName, setMessdienstName] = useState("");
  const toast = useToast();

  const loaded = landlord !== undefined && messdienst !== undefined;

  const startEditing = () => {
    if (!loaded) return;
    setForm(landlord);
    setMessdienstName(messdienst);
    setEditing(true);
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await db.settings.put({ key: "landlord", value: form });
      await db.settings.put({ key: "messdienstName", value: messdienstName });
      toast.success("Einstellungen gespeichert.");
      setEditing(false);
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Vermieter & Messdienst"
      description="Diese Daten erscheinen auf Abrechnungen und Mietverträgen."
      action={
        !editing ? (
          <Button variant="ghost" size="sm" onClick={startEditing} disabled={!loaded}>
            Bearbeiten
          </Button>
        ) : undefined
      }
    >
      {!editing ? (
        <dl className="text-sm text-fg-muted space-y-1.5">
          <Row label="Vermieter" value={landlord?.name} />
          <Row label="Adresse" value={landlord?.address} />
          <Row label="IBAN" value={landlord?.iban} />
          <Row label="Steuer-ID" value={landlord?.taxId} />
          <Row label="Messdienstleister" value={messdienst} />
        </dl>
      ) : (
        <div className="space-y-3">
          {(
            [
              { key: "name", label: "Vermieter-Name" },
              { key: "address", label: "Adresse" },
              { key: "iban", label: "IBAN" },
              { key: "taxId", label: "Steuer-ID" },
            ] as const
          ).map((field) => (
            <FormField key={field.key} label={field.label}>
              <Input
                value={form[field.key] ?? ""}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
              />
            </FormField>
          ))}
          <FormField label="Messdienstleister">
            <Input
              value={messdienstName}
              onChange={(e) => setMessdienstName(e.target.value)}
              placeholder="z.B. Brunata, Techem, Ista"
            />
          </FormField>
          <div className="flex gap-2 pt-1">
            <Button variant="primary" onClick={handleSave} loading={busy}>
              Speichern
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium min-w-[140px] text-fg-muted">{label}:</dt>
      <dd>{value || "–"}</dd>
    </div>
  );
}
