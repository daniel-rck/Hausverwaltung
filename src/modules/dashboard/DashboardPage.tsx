import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { seedDatabase } from '../../db/seed';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import {
  Button,
  FormField,
  Input,
  KpiTile,
  Modal,
  useToast,
  useConfirm,
  moduleAccent,
  type ModulKey,
} from '../../components/ui';
import { useFormValidation, required } from '../../components/ui/useFormValidation';
import { PageHeader } from '../../components/layout/PageHeader';
import { QuickStats } from './QuickStats';
import { AlertsList } from './AlertsList';
import { ExportImport } from './ExportImport';
import { SyncSettings } from '../../components/sync/SyncSettings';
import { AnnualReport } from './AnnualReport';
import { formatEuro } from '../../utils/format';
import type { LandlordInfo } from '../../db/schema';

interface ModuleLink {
  path: string;
  label: string;
  icon: string;
  desc: string;
  accent: ModulKey;
}

const moduleLinks: ModuleLink[] = [
  { path: '/mieter', label: 'Mieter', icon: '👤', desc: 'Wohnungen & Mieter verwalten', accent: 'mieter' },
  { path: '/nebenkosten', label: 'Nebenkosten', icon: '📋', desc: 'Abrechnungen erstellen', accent: 'nebenkosten' },
  { path: '/zaehler', label: 'Zähler', icon: '🔢', desc: 'Zählerstände erfassen', accent: 'zaehler' },
  { path: '/wasser', label: 'Wasser', icon: '💧', desc: 'Verbrauch analysieren', accent: 'wasser' },
  { path: '/finanzen', label: 'Finanzen', icon: '💶', desc: 'Mieteinnahmen tracken', accent: 'finanzen' },
  { path: '/instandhaltung', label: 'Instandhaltung', icon: '🔧', desc: 'Reparaturen & Wartungen', accent: 'instandhaltung' },
  { path: '/uebergabe', label: 'Übergabe', icon: '🔑', desc: 'Protokolle erstellen', accent: 'uebergabe' },
  { path: '/rendite', label: 'Rendite', icon: '📈', desc: 'Wirtschaftlichkeit prüfen', accent: 'rendite' },
];

export function DashboardPage() {
  const { activeProperty, properties, addProperty } = useProperty();
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Seed DB on first load
  useEffect(() => {
    seedDatabase();
  }, []);

  if (!activeProperty) {
    return (
      <>
        <EmptyState
          icon="🏠"
          title="Willkommen bei Hausverwaltung"
          description="Lege dein erstes Mietobjekt an, um zu starten."
          action={{
            label: 'Objekt anlegen',
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

      {/* Module-Kacheln */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3">
          Module
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {moduleLinks.map((m) => {
            const a = moduleAccent(m.accent)!;
            return (
              <Link
                key={m.path}
                to={m.path}
                className={`group block bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 p-4 transition-all hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-stone-400 dark:focus-visible:ring-offset-stone-900`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-xl ${a.pillBg} ${a.text}`}
                >
                  {m.icon}
                </span>
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 mt-3">
                  {m.label}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{m.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <AlertsList />
        <div className="space-y-4">
          <SyncSettings />
          <ExportImport />
          <SettingsCard />
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
  const [form, setForm] = useState({ name: '', address: '' });
  const toast = useToast();
  const confirm = useConfirm();
  const { errors, validate } = useFormValidation<typeof form>({
    name: required('Bitte Name angeben'),
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
      toast.success('Objekt aktualisiert.');
      setEditing(false);
    } catch (err) {
      toast.error('Speichern fehlgeschlagen.');
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Objekt löschen?',
      message: `„${activeProperty.name}" und alle zugehörigen Daten (Wohnungen, Mieter, etc.) werden gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`,
      confirmLabel: 'Endgültig löschen',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProperty(activeProperty.id!);
      toast.success('Objekt gelöscht.');
    } catch (err) {
      toast.error('Löschen fehlgeschlagen.');
      console.error(err);
    }
  };

  if (!editing) {
    return (
      <PageHeader
        title={activeProperty.name}
        description={activeProperty.address || undefined}
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
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
  const [form, setForm] = useState({ name: '', address: '', units: 1 });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { errors, validate } = useFormValidation<typeof form>({
    name: required('Bitte Name angeben'),
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
      toast.success('Objekt angelegt.');
      onClose();
    } catch (err) {
      toast.error('Anlegen fehlgeschlagen.');
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
      const units = await db.units.where('propertyId').equals(prop.id!).toArray();

      const unitIds = units.map((u) => u.id!);
      totalUnits += units.length;

      const occupancies = await db.occupancies.toArray();
      const active = occupancies.filter(
        (o) =>
          unitIds.includes(o.unitId) &&
          o.from <= now &&
          (o.to === null || o.to >= now),
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
    <Card title="Portfolio-Übersicht (alle Objekte)">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiTile label="Objekte" value={portfolioData.totalProperties} />
        <KpiTile label="Wohneinheiten" value={portfolioData.totalUnits} />
        <KpiTile label="Vermietet" value={portfolioData.totalOccupied} accent="mieter" />
        <KpiTile
          label="Leerstand"
          value={portfolioData.totalVacant}
          accent={portfolioData.totalVacant > 0 ? 'nebenkosten' : undefined}
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

function SettingsCard() {
  const landlord = useLiveQuery(async () => {
    const setting = await db.settings.get('landlord');
    return (setting?.value as LandlordInfo) ?? { name: '', address: '', iban: '', taxId: '' };
  });

  const messdienst = useLiveQuery(async () => {
    const setting = await db.settings.get('messdienstName');
    return (setting?.value as string) ?? 'Messdienstleister';
  });

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<LandlordInfo>({ name: '', address: '', iban: '', taxId: '' });
  const [messdienstName, setMessdienstName] = useState('');
  const toast = useToast();

  const startEditing = () => {
    if (landlord) setForm(landlord);
    if (messdienst) setMessdienstName(messdienst);
    setEditing(true);
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await db.settings.put({ key: 'landlord', value: form });
      await db.settings.put({ key: 'messdienstName', value: messdienstName });
      toast.success('Einstellungen gespeichert.');
      setEditing(false);
    } catch (err) {
      toast.error('Speichern fehlgeschlagen.');
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Einstellungen"
      action={
        !editing ? (
          <Button variant="ghost" size="sm" onClick={startEditing}>
            Bearbeiten
          </Button>
        ) : undefined
      }
    >
      {!editing ? (
        <dl className="text-sm text-stone-600 dark:text-stone-300 space-y-1">
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
              { key: 'name', label: 'Vermieter-Name' },
              { key: 'address', label: 'Adresse' },
              { key: 'iban', label: 'IBAN' },
              { key: 'taxId', label: 'Steuer-ID' },
            ] as const
          ).map((field) => (
            <FormField key={field.key} label={field.label}>
              <Input
                value={form[field.key] ?? ''}
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
      <dt className="font-medium min-w-[140px] text-stone-500 dark:text-stone-400">{label}:</dt>
      <dd>{value || '–'}</dd>
    </div>
  );
}
