import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { seedDatabase } from '../../db/seed';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { QuickStats } from './QuickStats';
import { AlertsList } from './AlertsList';
import { ExportImport } from './ExportImport';
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
  const { activeProperty, addProperty } = useProperty();

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
      <h1 className="text-xl font-bold text-stone-800">
        {activeProperty.name}
      </h1>

      <QuickStats />

      {/* Module-Kacheln */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {moduleLinks.map((m) => (
          <Link
            key={m.path}
            to={m.path}
            className={`block bg-white rounded-xl border-2 ${m.color} p-4 transition-colors`}
          >
            <span className="text-2xl">{m.icon}</span>
            <p className="text-sm font-semibold text-stone-800 mt-2">{m.label}</p>
            <p className="text-xs text-stone-500 mt-0.5">{m.desc}</p>
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
    </div>
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

  useEffect(() => {
    if (landlord) setForm(landlord);
  }, [landlord]);

  useEffect(() => {
    if (messdienst) setMessdienstName(messdienst);
  }, [messdienst]);

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
            onClick={() => setEditing(true)}
            className="text-xs text-stone-500 hover:text-stone-700"
          >
            Bearbeiten
          </button>
        ) : undefined
      }
    >
      {!editing ? (
        <div className="text-sm text-stone-600 space-y-1">
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
              <label className="block text-xs font-medium text-stone-500 mb-1">
                {field.label}
              </label>
              <input
                type="text"
                value={form[field.key] ?? ''}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">
              Messdienstleister
            </label>
            <input
              type="text"
              value={messdienstName}
              onChange={(e) => setMessdienstName(e.target.value)}
              placeholder="z.B. Brunata, Techem, Ista"
              className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
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
              className="px-4 py-1.5 text-sm border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
