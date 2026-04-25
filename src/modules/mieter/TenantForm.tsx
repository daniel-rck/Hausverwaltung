import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { cascadeDeleteOccupancy } from '../../db/cascade';
import { Card } from '../../components/shared/Card';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatEuro, formatMonth } from '../../utils/format';
import { RentHistory } from './RentHistory';
import { DepositManager } from './DepositManager';
import { DocumentStore } from './DocumentStore';
import { ContractTemplate } from './ContractTemplate';
import type { Unit, Tenant, Occupancy } from '../../db/schema';

interface TenantFormProps {
  unit: Unit;
  onBack: () => void;
}

interface OccupancyRow {
  occupancy: Occupancy;
  tenant: Tenant | null;
}

export function TenantForm({ unit, onBack }: TenantFormProps) {
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [showOccForm, setShowOccForm] = useState(false);
  const [contractOcc, setContractOcc] = useState<{ occupancy: Occupancy; tenant: Tenant } | null>(null);
  const [tenantForm, setTenantForm] = useState({ name: '', email: '', phone: '', notes: '' });

  const tenants = useLiveQuery(
    () => db.tenants.where('unitId').equals(unit.id!).toArray(),
    [unit.id],
  );

  const rows = useLiveQuery(async () => {
    const occupancies = await db.occupancies
      .where('unitId')
      .equals(unit.id!)
      .toArray();

    const result: OccupancyRow[] = [];
    for (const occ of occupancies) {
      const tenant = (await db.tenants.get(occ.tenantId)) ?? null;
      result.push({ occupancy: occ, tenant });
    }

    return result.sort((a, b) => b.occupancy.from.localeCompare(a.occupancy.from));
  }, [unit.id]);

  const handleSaveTenant = async () => {
    if (!tenantForm.name.trim()) return;

    await db.tenants.add({
      unitId: unit.id!,
      name: tenantForm.name.trim(),
      email: tenantForm.email || undefined,
      phone: tenantForm.phone || undefined,
      notes: tenantForm.notes || undefined,
    });

    setTenantForm({ name: '', email: '', phone: '', notes: '' });
    setShowTenantForm(false);
  };

  // Occupancy form state
  const [occForm, setOccForm] = useState({
    tenantId: '',
    persons: '1',
    from: '',
    to: '',
    rentCold: '',
    rentUtilities: '',
    deposit: '',
    depositPaid: false,
  });


  const handleSaveOccupancy = async () => {
    const tenantId = parseInt(occForm.tenantId);
    if (!tenantId || !occForm.from) return;

    await db.occupancies.add({
      unitId: unit.id!,
      tenantId,
      persons: parseInt(occForm.persons) || 1,
      from: occForm.from,
      to: occForm.to || null,
      rentCold: parseFloat(occForm.rentCold.replace(',', '.')) || 0,
      rentUtilities: parseFloat(occForm.rentUtilities.replace(',', '.')) || 0,
      deposit: parseFloat(occForm.deposit.replace(',', '.')) || 0,
      depositPaid: occForm.depositPaid,
    });

    setOccForm({
      tenantId: '',
      persons: '1',
      from: '',
      to: '',
      rentCold: '',
      rentUtilities: '',
      deposit: '',
      depositPaid: false,
    });
    setShowOccForm(false);
  };

  const handleDeleteOccupancy = async (id: number) => {
    await cascadeDeleteOccupancy(id);
  };

  const columns: Column<OccupancyRow>[] = [
    {
      key: 'tenant',
      header: 'Mieter',
      render: (r) => r.tenant?.name ?? '–',
    },
    {
      key: 'from',
      header: 'Von',
      render: (r) => formatMonth(r.occupancy.from),
      sortValue: (r) => r.occupancy.from,
    },
    {
      key: 'to',
      header: 'Bis',
      render: (r) =>
        r.occupancy.to ? formatMonth(r.occupancy.to) : (
          <StatusBadge status="green" label="Aktuell" />
        ),
    },
    {
      key: 'persons',
      header: 'Personen',
      render: (r) => r.occupancy.persons,
      align: 'center',
    },
    {
      key: 'rent',
      header: 'Miete (kalt + NK)',
      render: (r) => (
        <span className="font-mono font-tabular">
          {formatEuro(r.occupancy.rentCold)} + {formatEuro(r.occupancy.rentUtilities)}
        </span>
      ),
      align: 'right',
    },
    {
      key: 'deposit',
      header: 'Kaution',
      render: (r) => (
        <span className="font-mono font-tabular">
          {formatEuro(r.occupancy.deposit)}
          {r.occupancy.depositPaid ? (
            <StatusBadge status="green" label="Bezahlt" />
          ) : (
            <StatusBadge status="red" label="Offen" />
          )}
        </span>
      ),
      align: 'right',
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex gap-2">
          {r.tenant && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setContractOcc({ occupancy: r.occupancy, tenant: r.tenant! });
              }}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              Vertrag
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteOccupancy(r.occupancy.id!);
            }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Löschen
          </button>
        </div>
      ),
    },
  ];

  if (contractOcc) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setContractOcc(null)}
          className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
        >
          ← Zurück zur Wohnung
        </button>
        <ContractTemplate occupancy={contractOcc.occupancy} unit={unit} tenant={contractOcc.tenant} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 flex items-center gap-1"
      >
        ← Zurück zur Übersicht
      </button>

      <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">
        Wohnung: {unit.name}
        {unit.floor && <span className="text-stone-500 dark:text-stone-400 font-normal"> ({unit.floor})</span>}
      </h2>

      {/* Mieter-Verwaltung */}
      <Card
        title="Mieter"
        action={
          <button
            onClick={() => setShowTenantForm(true)}
            className="text-sm px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            + Mieter
          </button>
        }
      >
        {showTenantForm && (
          <div className="mb-4 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-200 dark:border-stone-700">
            <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-3">Neuer Mieter</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={tenantForm.name}
                  onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                  className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">E-Mail</label>
                <input
                  type="email"
                  value={tenantForm.email}
                  onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
                  className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={tenantForm.phone}
                  onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                  className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Notizen</label>
                <input
                  type="text"
                  value={tenantForm.notes}
                  onChange={(e) => setTenantForm({ ...tenantForm, notes: e.target.value })}
                  className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSaveTenant}
                className="px-4 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors"
              >
                Speichern
              </button>
              <button
                onClick={() => setShowTenantForm(false)}
                className="px-4 py-1.5 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {tenants && tenants.length > 0 ? (
          <ul className="divide-y divide-stone-100">
            {tenants.map((t) => (
              <li key={t.id} className="py-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{t.name}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {[t.email, t.phone].filter(Boolean).join(' | ') || 'Keine Kontaktdaten'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setOccForm((f) => ({ ...f, tenantId: String(t.id!) }));
                    setShowOccForm(true);
                  }}
                  className="text-xs px-2 py-1 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors"
                >
                  Belegung anlegen
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-500 dark:text-stone-400">Noch keine Mieter angelegt.</p>
        )}
      </Card>

      {/* Belegung anlegen */}
      {showOccForm && (
        <Card title="Neue Belegung">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Mieter *</label>
              <select
                value={occForm.tenantId}
                onChange={(e) => setOccForm({ ...occForm, tenantId: e.target.value })}
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              >
                <option value="">Bitte wählen</option>
                {tenants?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Personen</label>
              <input
                type="number"
                min="1"
                value={occForm.persons}
                onChange={(e) => setOccForm({ ...occForm, persons: e.target.value })}
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Einzug (Monat) *</label>
              <input
                type="month"
                value={occForm.from}
                onChange={(e) => setOccForm({ ...occForm, from: e.target.value })}
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Auszug (leer = aktuell)</label>
              <input
                type="month"
                value={occForm.to}
                onChange={(e) => setOccForm({ ...occForm, to: e.target.value })}
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Kaltmiete</label>
              <input
                type="text"
                inputMode="decimal"
                value={occForm.rentCold}
                onChange={(e) => setOccForm({ ...occForm, rentCold: e.target.value })}
                placeholder="z.B. 450,00"
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">NK-Vorauszahlung</label>
              <input
                type="text"
                inputMode="decimal"
                value={occForm.rentUtilities}
                onChange={(e) => setOccForm({ ...occForm, rentUtilities: e.target.value })}
                placeholder="z.B. 150,00"
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Kaution</label>
              <input
                type="text"
                inputMode="decimal"
                value={occForm.deposit}
                onChange={(e) => setOccForm({ ...occForm, deposit: e.target.value })}
                placeholder="z.B. 1350,00"
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300 pb-1.5">
                <input
                  type="checkbox"
                  checked={occForm.depositPaid}
                  onChange={(e) => setOccForm({ ...occForm, depositPaid: e.target.checked })}
                  className="rounded border-stone-300 dark:border-stone-600"
                />
                Kaution bezahlt
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSaveOccupancy}
              className="px-4 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors"
            >
              Belegung speichern
            </button>
            <button
              onClick={() => {
                setShowOccForm(false);
              }}
              className="px-4 py-1.5 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </Card>
      )}

      {/* Belegungshistorie */}
      <Card title="Belegungshistorie">
        {rows && rows.length > 0 ? (
          <DataTable
            columns={columns}
            data={rows}
            keyFn={(r) => r.occupancy.id!}
          />
        ) : (
          <p className="text-sm text-stone-500 dark:text-stone-400">Noch keine Belegungen vorhanden.</p>
        )}
      </Card>

      {/* Miethistorie & Kaution für aktuelle Belegung */}
      {rows && rows.length > 0 && (() => {
        const now = new Date().toISOString().slice(0, 7);
        const current = rows.find(
          (r) => r.occupancy.from <= now && (r.occupancy.to === null || r.occupancy.to >= now),
        );
        if (!current) return null;
        return (
          <>
            <RentHistory occupancy={current.occupancy} unit={unit} />
            <DepositManager occupancy={current.occupancy} />
          </>
        );
      })()}

      {/* Dokumente */}
      <DocumentStore entityType="unit" entityId={unit.id!} title="Dokumente zur Wohnung" />
    </div>
  );
}
