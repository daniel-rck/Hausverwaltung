import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { seedDatabase } from '../../db/seed';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { QuickStats } from './QuickStats';
import { AlertsList } from './AlertsList';
import { ExportImport } from './ExportImport';
import { formatEuro } from '../../utils/format';
import type { LandlordInfo } from '../../db/schema';

const moduleLinks = [
  { path: '/mieter', label: 'Mieter', icon: '👤', desc: 'Wohnungen & Mieter verwalten', color: 'border-green-200 hover:border-green-400' },
  { path: '/nebenkosten', label: 'Nebenkosten', icon: '📋', desc: 'Abrechnungen erstellen', color: 'border-amber-200 hover:border-amber-400' },
  { path: '/zaehler', label: 'Zähler', icon: '🔢', desc: 'Zählerstände erfassen', color: 'border-violet-200 hover:border-violet-400' },
  { path: '/wasser', label: 'Wasser', icon: '💧', desc: 'Verbrauch analysieren', color: 'border-cyan-200 hover:border-cyan-400' },
  { path: '/finanzen', label: 'Finanzen', icon: '💶', desc: 'Mieteinnahmen tracken', color: 'border-emerald-200 hover:border-emerald-400' },
  { path: '/instandhaltung', label: 'Instandhaltung', icon: '🔧', desc: 'Reparaturen & Wartungen', color: 'border-rose-200 hover:border-rose-400' },
  { path: '/uebergabe', label: 'Übergabe', icon: '🔑', desc: 'Protokolle erstellen', color: 'border-blue-200 hover:border-blue-400' },
  { path: '/rendite', label: 'Rendite', icon: '📈', desc: 'Wirtschaftlichkeit prüfen', color: 'border-yellow-200 hover:border-yellow-400' },
];

export function DashboardPage() {
  const { activeProperty, properties, addProperty } = useProperty();

  // Seed DB on first load
  useEffect(() => {
    seedDatabase();
  }, []);

  if (!activeProperty) {
    return (
      <EmptyState
        icon="🏠"
        title="Willkommen bei Hausverwaltung"
        description="Legen Sie Ihr erstes Mietobjekt an, um zu starten."
        action={{
          label: 'Objekt anlegen',
          onClick: () => addProperty({ name: 'Mein Haus', address: '', units: 0 }),
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PropertyCard />

      <QuickStats />

      {/* Module-Kacheln */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {moduleLinks.map((m) => (
          <Link
            key={m.path}
            to={m.path}
            className={`block bg-white dark:bg-stone-800 rounded-xl border-2 ${m.color} p-4 transition-colors`}
          >
            <span className="text-2xl">{m.icon}</span>
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 mt-2">{m.label}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{m.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <AlertsList />
        <div className="space-y-4">
          <ExportImport />
          <SettingsCard />
        </div>
      </div>

      {/* Portfolio-Übersicht wenn mehrere Objekte */}
      {properties.length > 1 && <PortfolioOverview />}
    </div>
  );
}

/** Objekt anzeigen / bearbeiten / löschen */
function PropertyCard() {
  const { activeProperty, updateProperty, deleteProperty, properties } = useProperty();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({ name: '', address: '' });

  if (!activeProperty) return null;

  const startEditing = () => {
    setForm({ name: activeProperty.name, address: activeProperty.address });
    setEditing(true);
  };

  const handleSave = async () => {
    await updateProperty({
      ...activeProperty,
      name: form.name.trim() || activeProperty.name,
      address: form.address,
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    await deleteProperty(activeProperty.id!);
  };

  if (!editing) {
    return (
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">{activeProperty.name}</h1>
          {activeProperty.address && (
            <p className="text-sm text-stone-500 dark:text-stone-400">{activeProperty.address}</p>
          )}
        </div>
        <button
          onClick={startEditing}
          className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 mt-1"
        >
          Bearbeiten
        </button>
      </div>
    );
  }

  return (
    <>
      <Card title="Objekt bearbeiten">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Adresse</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors"
            >
              Speichern
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-1.5 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
            >
              Abbrechen
            </button>
            {properties.length > 1 && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-1.5 text-sm text-red-600 hover:text-red-700 ml-auto"
              >
                Objekt löschen
              </button>
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Objekt löschen?"
        message={`"${activeProperty.name}" und alle zugehörigen Daten (Wohnungen, Mieter, etc.) werden gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Endgültig löschen"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        danger
      />
    </>
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
      const units = await db.units
        .where('propertyId')
        .equals(prop.id!)
        .toArray();

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
      totalMonthlyRent += active.reduce(
        (s, o) => s + o.rentCold + o.rentUtilities,
        0,
      );
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
        <div>
          <p className="text-xs text-stone-500 dark:text-stone-400">Objekte</p>
          <p className="text-lg font-semibold font-mono font-tabular text-stone-700 dark:text-stone-200">
            {portfolioData.totalProperties}
          </p>
        </div>
        <div>
          <p className="text-xs text-stone-500 dark:text-stone-400">Wohneinheiten</p>
          <p className="text-lg font-semibold font-mono font-tabular text-stone-700 dark:text-stone-200">
            {portfolioData.totalUnits}
          </p>
        </div>
        <div>
          <p className="text-xs text-stone-500 dark:text-stone-400">Vermietet</p>
          <p className="text-lg font-semibold font-mono font-tabular text-green-600">
            {portfolioData.totalOccupied}
          </p>
        </div>
        <div>
          <p className="text-xs text-stone-500 dark:text-stone-400">Leerstand</p>
          <p className={`text-lg font-semibold font-mono font-tabular ${portfolioData.totalVacant > 0 ? 'text-amber-600' : 'text-stone-400 dark:text-stone-500'}`}>
            {portfolioData.totalVacant}
          </p>
        </div>
        <div>
          <p className="text-xs text-stone-500 dark:text-stone-400">Monatsmiete gesamt</p>
          <p className="text-lg font-semibold font-mono font-tabular text-emerald-600">
            {formatEuro(portfolioData.totalMonthlyRent)}
          </p>
        </div>
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
  const [form, setForm] = useState<LandlordInfo>({ name: '', address: '', iban: '', taxId: '' });
  const [messdienstName, setMessdienstName] = useState('');

  const startEditing = () => {
    if (landlord) setForm(landlord);
    if (messdienst) setMessdienstName(messdienst);
    setEditing(true);
  };

  const handleSave = async () => {
    await db.settings.put({ key: 'landlord', value: form });
    await db.settings.put({ key: 'messdienstName', value: messdienstName });
    setEditing(false);
  };

  return (
    <Card
      title="Einstellungen"
      action={
        !editing ? (
          <button
            onClick={startEditing}
            className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
          >
            Bearbeiten
          </button>
        ) : undefined
      }
    >
      {!editing ? (
        <div className="text-sm text-stone-600 dark:text-stone-300 space-y-1">
          <p><strong>Vermieter:</strong> {landlord?.name || '–'}</p>
          <p><strong>Adresse:</strong> {landlord?.address || '–'}</p>
          <p><strong>IBAN:</strong> {landlord?.iban || '–'}</p>
          <p><strong>Steuer-ID:</strong> {landlord?.taxId || '–'}</p>
          <p><strong>Messdienstleister:</strong> {messdienst || '–'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {([
            { key: 'name', label: 'Vermieter-Name' },
            { key: 'address', label: 'Adresse' },
            { key: 'iban', label: 'IBAN' },
            { key: 'taxId', label: 'Steuer-ID' },
          ] as const).map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                {field.label}
              </label>
              <input
                type="text"
                value={form[field.key] ?? ''}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
              Messdienstleister
            </label>
            <input
              type="text"
              value={messdienstName}
              onChange={(e) => setMessdienstName(e.target.value)}
              placeholder="z.B. Brunata, Techem, Ista"
              className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors"
            >
              Speichern
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-1.5 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
