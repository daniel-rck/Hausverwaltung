import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db, useLiveQuery } from "../../lib/db";
import { seedDatabase } from "../../lib/db/seed";
import { useProperty } from "../../lib/hooks/useProperty";
import { PageHeader } from "../../lib/ui/layout/PageHeader";
import { Card } from "../../lib/ui/shared/Card";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import {
  Button,
  FormField,
  Input,
  KpiTile,
  Modal,
  type ModulKey,
  useConfirm,
  useToast,
} from "../../lib/ui/ui";
import { Building2, type ModulIconKey, ModulIcons } from "../../lib/ui/ui/icons";
import { required, useFormValidation } from "../../lib/ui/ui/useFormValidation";
import { formatEuro } from "../../lib/utils/format";
import { AlertsList } from "./AlertsList";
import { AnnualReport } from "./AnnualReport";
import { QuickStats } from "./QuickStats";

interface ModuleLink {
  path: string;
  label: string;
  iconKey: ModulIconKey;
  desc: string;
  accent: ModulKey;
}

const moduleLinks: ModuleLink[] = [
  {
    path: "/mieter",
    label: "Mieter",
    iconKey: "mieter",
    desc: "Wohnungen & Mieter verwalten",
    accent: "mieter",
  },
  {
    path: "/nebenkosten",
    label: "Nebenkosten",
    iconKey: "nebenkosten",
    desc: "Abrechnungen erstellen",
    accent: "nebenkosten",
  },
  {
    path: "/zaehler",
    label: "Zähler",
    iconKey: "zaehler",
    desc: "Zählerstände erfassen",
    accent: "zaehler",
  },
  {
    path: "/wasser",
    label: "Versorger",
    iconKey: "wasser",
    desc: "Verbrauch analysieren",
    accent: "wasser",
  },
  {
    path: "/finanzen",
    label: "Finanzen",
    iconKey: "finanzen",
    desc: "Mieteinnahmen tracken",
    accent: "finanzen",
  },
  {
    path: "/instandhaltung",
    label: "Instandhaltung",
    iconKey: "instandhaltung",
    desc: "Reparaturen & Wartungen",
    accent: "instandhaltung",
  },
  {
    path: "/uebergabe",
    label: "Übergabe",
    iconKey: "uebergabe",
    desc: "Protokolle erstellen",
    accent: "uebergabe",
  },
  {
    path: "/rendite",
    label: "Rendite",
    iconKey: "rendite",
    desc: "Wirtschaftlichkeit prüfen",
    accent: "rendite",
  },
];

export function DashboardPage() {
  const { activeProperty, properties, addProperty } = useProperty();
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    seedDatabase();
  }, []);

  if (!activeProperty) {
    return (
      <>
        <EmptyState
          icon={<Building2 size={24} strokeWidth={1.75} />}
          title="Willkommen bei Hausverwaltung"
          description="Lege dein erstes Mietobjekt an, um zu starten."
          action={{
            label: "Objekt anlegen",
            onClick: () => setWelcomeOpen(true),
          }}
        />
        <WelcomeModal
          open={welcomeOpen}
          onClose={() => setWelcomeOpen(false)}
          onCreate={async (data) => {
            await addProperty(data);
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PropertyCard />

      <QuickStats />

      <AlertsList />

      {/* Module-Kacheln */}
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted mb-3">
          Module
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {moduleLinks.map((m) => {
            const Icon = ModulIcons[m.iconKey];
            return (
              <Link
                key={m.path}
                to={m.path}
                className="group block bg-surface rounded-lg border border-border p-4 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[--color-accent]/40 dark:focus-visible:ring-offset-zinc-950"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-surface-sunken text-fg"
                >
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <p className="text-sm font-semibold text-fg tracking-tight mt-3">{m.label}</p>
                <p className="text-xs text-fg-muted mt-0.5">{m.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Jahresabschluss */}
      <AnnualReport propertyId={activeProperty.id!} />

      {/* Portfolio-Übersicht wenn mehrere Objekte */}
      {properties.length > 1 && <PortfolioOverview />}
    </div>
  );
}

/** Objekt anzeigen / bearbeiten / löschen */
function PropertyCard() {
  const { activeProperty, updateProperty, deleteProperty, properties } = useProperty();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", address: "" });
  const toast = useToast();
  const confirm = useConfirm();
  const { errors, validate } = useFormValidation<typeof form>({
    name: required("Bitte Name angeben"),
  });

  if (!activeProperty) return null;

  const startEditing = () => {
    setForm({ name: activeProperty.name, address: activeProperty.address });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!validate(form)) return;
    setBusy(true);
    try {
      await updateProperty({
        ...activeProperty,
        name: form.name.trim() || activeProperty.name,
        address: form.address,
      });
      toast.success("Objekt aktualisiert.");
      setEditing(false);
    } catch (err) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Objekt löschen?",
      message: `„${activeProperty.name}“ und alle zugehörigen Daten (Wohnungen, Mieter, etc.) werden gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`,
      confirmLabel: "Endgültig löschen",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProperty(activeProperty.id!);
      toast.success("Objekt gelöscht.");
    } catch (err) {
      toast.error("Löschen fehlgeschlagen.");
      console.error(err);
    }
  };

  if (!editing) {
    return (
      <PageHeader
        title={activeProperty.name}
        description={activeProperty.address || undefined}
        icon={<Building2 size={20} strokeWidth={1.75} />}
        actions={
          <Button variant="ghost" size="sm" onClick={startEditing}>
            Bearbeiten
          </Button>
        }
      />
    );
  }

  return (
    <Card title="Objekt bearbeiten">
      <div className="space-y-3">
        <FormField label="Name" required error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Adresse">
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </FormField>
        <div className="flex gap-2">
          <Button variant="primary" onClick={handleSave} loading={busy}>
            Speichern
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
            Abbrechen
          </Button>
          {properties.length > 1 && (
            <div className="ml-auto">
              <Button variant="danger" size="sm" onClick={handleDelete}>
                Objekt löschen
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; address: string; units: number }) => Promise<void>;
}

function WelcomeModal({ open, onClose, onCreate }: WelcomeModalProps) {
  const [form, setForm] = useState({ name: "", address: "", units: 1 });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { errors, validate } = useFormValidation<typeof form>({
    name: required("Bitte Name angeben"),
  });

  const handleCreate = async () => {
    if (!validate(form)) return;
    setBusy(true);
    try {
      await onCreate({
        name: form.name.trim(),
        address: form.address.trim(),
        units: Math.max(0, Number(form.units) || 0),
      });
      toast.success("Objekt angelegt.");
      onClose();
    } catch (err) {
      toast.error("Anlegen fehlgeschlagen.");
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Willkommen — erstes Objekt anlegen"
      description="Gib deinem Mietobjekt einen Namen. Adresse und Einheiten kannst du später ergänzen."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={handleCreate} loading={busy}>
            Objekt anlegen
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Name" required error={errors.name}>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z.B. Hauptstr. 12"
            autoFocus
          />
        </FormField>
        <FormField label="Adresse">
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Straße, PLZ, Ort"
          />
        </FormField>
        <FormField label="Anzahl Wohneinheiten" hint="optional">
          <Input
            type="number"
            min={0}
            value={form.units}
            onChange={(e) => setForm({ ...form, units: Number(e.target.value) })}
          />
        </FormField>
      </div>
    </Modal>
  );
}

/** Objektübergreifende Übersicht */
function PortfolioOverview() {
  const { properties } = useProperty();

  const portfolioData = useLiveQuery(async () => {
    const now = new Date().toISOString().slice(0, 7);
    let totalUnits = 0;
    let totalOccupied = 0;
    let totalMonthlyRent = 0;

    for (const prop of properties) {
      const units = await db.units.where("propertyId").equals(prop.id!).toArray();

      const unitIds = units.map((u) => u.id!);
      totalUnits += units.length;

      const occupancies = await db.occupancies.toArray();
      const active = occupancies.filter(
        (o) => unitIds.includes(o.unitId) && o.from <= now && (o.to === null || o.to >= now),
      );

      const occupied = new Set(active.map((o) => o.unitId)).size;
      totalOccupied += occupied;
      totalMonthlyRent += active.reduce((s, o) => s + o.rentCold + o.rentUtilities, 0);
    }

    return {
      totalProperties: properties.length,
      totalUnits,
      totalOccupied,
      totalVacant: totalUnits - totalOccupied,
      totalMonthlyRent,
    };
  }, [properties]);

  if (!portfolioData) return null;

  return (
    <Card title="Portfolio-Übersicht" description="Alle Objekte zusammengefasst">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiTile label="Objekte" value={portfolioData.totalProperties} />
        <KpiTile label="Wohneinheiten" value={portfolioData.totalUnits} />
        <KpiTile label="Vermietet" value={portfolioData.totalOccupied} accent="mieter" />
        <KpiTile
          label="Leerstand"
          value={portfolioData.totalVacant}
          accent={portfolioData.totalVacant > 0 ? "nebenkosten" : undefined}
        />
        <KpiTile
          label="Monatsmiete gesamt"
          value={formatEuro(portfolioData.totalMonthlyRent)}
          accent="finanzen"
        />
      </div>
    </Card>
  );
}
