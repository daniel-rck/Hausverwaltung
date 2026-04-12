import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { RoomInspection, createDefaultRooms } from './RoomInspection';
import { MeterSnapshot as MeterSnapshotComponent } from './MeterSnapshot';
import { KeyHandover, createDefaultKeys } from './KeyHandover';
import { SignatureCanvas } from './SignatureCanvas';
import { UebergabePrint } from './UebergabePrint';
import type { ProtocolContext, MeterDetail } from './UebergabePrint';
import { formatDate } from '../../utils/format';
import type { HandoverProtocol, RoomCondition, Occupancy, Tenant, Unit, LandlordInfo } from '../../db/schema';

type Step = 'list' | 'setup' | 'rooms' | 'meters' | 'keys' | 'signatures' | 'preview';

interface OccRow {
  occupancy: Occupancy;
  tenant: Tenant | null;
  unit: Unit;
}

export function UebergabePage() {
  const { activeProperty, addProperty } = useProperty();
  const [step, setStep] = useState<Step>('list');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form state
  const [selectedOccId, setSelectedOccId] = useState<number | null>(null);
  const [protocolType, setProtocolType] = useState<'move-in' | 'move-out'>('move-in');
  const [protocolDate, setProtocolDate] = useState(new Date().toISOString().slice(0, 10));
  const [rooms, setRooms] = useState<RoomCondition[]>(createDefaultRooms());
  const [meterReadings, setMeterReadings] = useState<{ meterId: number; value: number }[]>([]);
  const [keys, setKeys] = useState(createDefaultKeys());
  const [notes, setNotes] = useState('');
  const [sigLandlord, setSigLandlord] = useState<string | undefined>();
  const [sigTenant, setSigTenant] = useState<string | undefined>();
  const [previewId, setPreviewId] = useState<number | null>(null);

  const occupancies = useLiveQuery(async (): Promise<OccRow[]> => {
    if (!activeProperty?.id) return [];
    const units = await db.units.where('propertyId').equals(activeProperty.id).toArray();
    const result: OccRow[] = [];
    for (const unit of units) {
      const occs = await db.occupancies.where('unitId').equals(unit.id!).toArray();
      for (const occ of occs) {
        const tenant = await db.tenants.get(occ.tenantId) ?? null;
        result.push({ occupancy: occ, tenant, unit });
      }
    }
    return result;
  }, [activeProperty?.id]);

  const protocols = useLiveQuery(async (): Promise<(HandoverProtocol & { tenantName: string; unitName: string })[]> => {
    if (!activeProperty?.id) return [];
    const all = await db.handoverProtocols.toArray();
    const units = await db.units.where('propertyId').equals(activeProperty.id).toArray();
    const unitIds = new Set(units.map((u) => u.id!));
    const result: (HandoverProtocol & { tenantName: string; unitName: string })[] = [];
    for (const p of all) {
      const occ = await db.occupancies.get(p.occupancyId);
      if (!occ || !unitIds.has(occ.unitId)) continue;
      const tenant = await db.tenants.get(occ.tenantId);
      const unit = units.find((u) => u.id === occ.unitId);
      result.push({ ...p, tenantName: tenant?.name ?? '–', unitName: unit?.name ?? '–' });
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [activeProperty?.id]);

  if (!activeProperty) {
    return (
      <EmptyState
        icon="🏠"
        title="Kein Objekt vorhanden"
        description="Legen Sie zuerst ein Mietobjekt an."
        action={{ label: 'Objekt anlegen', onClick: () => addProperty({ name: 'Mein Haus', address: '', units: 0 }) }}
      />
    );
  }

  const resetForm = () => {
    setSelectedOccId(null);
    setProtocolType('move-in');
    setProtocolDate(new Date().toISOString().slice(0, 10));
    setRooms(createDefaultRooms());
    setMeterReadings([]);
    setKeys(createDefaultKeys());
    setNotes('');
    setSigLandlord(undefined);
    setSigTenant(undefined);
    setStep('list');
  };

  const handleSave = async () => {
    if (!selectedOccId) return;
    const protocol: Omit<HandoverProtocol, 'id'> = {
      occupancyId: selectedOccId,
      type: protocolType,
      date: protocolDate,
      rooms,
      meterReadings,
      keys: keys.filter((k) => k.count > 0),
      notes: notes || undefined,
      signatures: { landlord: sigLandlord, tenant: sigTenant },
    };
    await db.handoverProtocols.add(protocol as HandoverProtocol);
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteId) {
      await db.handoverProtocols.delete(deleteId);
      setDeleteId(null);
    }
  };

  const selectedOcc = occupancies?.find((o) => o.occupancy.id === selectedOccId);

  if (previewId) {
    return <ProtocolPreview protocolId={previewId} onBack={() => setPreviewId(null)} />;
  }

  if (step !== 'list') {
    return (
      <div className="space-y-4">
        <button onClick={resetForm} className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700">
          ← Abbrechen
        </button>
        <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">Neues Übergabeprotokoll</h1>

        {/* Progress */}
        <div className="flex gap-2 text-xs text-stone-400">
          {(['setup', 'rooms', 'meters', 'keys', 'signatures'] as Step[]).map((s, i) => (
            <span key={s} className={step === s ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}>
              {i + 1}. {s === 'setup' ? 'Grunddaten' : s === 'rooms' ? 'Räume' : s === 'meters' ? 'Zähler' : s === 'keys' ? 'Schlüssel' : 'Unterschriften'}
            </span>
          ))}
        </div>

        {step === 'setup' && (
          <Card title="Grunddaten">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Belegung *</label>
                <select
                  value={selectedOccId ?? ''}
                  onChange={(e) => setSelectedOccId(Number(e.target.value) || null)}
                  className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-700 dark:text-stone-200"
                >
                  <option value="">Bitte wählen</option>
                  {occupancies?.map((o) => (
                    <option key={o.occupancy.id} value={o.occupancy.id}>
                      {o.unit.name} – {o.tenant?.name ?? 'Unbekannt'} ({o.occupancy.from} bis {o.occupancy.to ?? 'heute'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Art</label>
                <select
                  value={protocolType}
                  onChange={(e) => setProtocolType(e.target.value as 'move-in' | 'move-out')}
                  className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-700 dark:text-stone-200"
                >
                  <option value="move-in">Einzug</option>
                  <option value="move-out">Auszug</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Datum</label>
                <input
                  type="date"
                  value={protocolDate}
                  onChange={(e) => setProtocolDate(e.target.value)}
                  className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-700 dark:text-stone-200"
                />
              </div>
              <button
                onClick={() => selectedOccId && setStep('rooms')}
                disabled={!selectedOccId}
                className="px-4 py-2 text-sm bg-stone-800 dark:bg-stone-600 text-white rounded-lg hover:bg-stone-900 dark:hover:bg-stone-500 transition-colors disabled:opacity-50"
              >
                Weiter
              </button>
            </div>
          </Card>
        )}

        {step === 'rooms' && (
          <>
            <RoomInspection rooms={rooms} onChange={setRooms} />
            <div className="flex gap-2">
              <button onClick={() => setStep('setup')} className="px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg">Zurück</button>
              <button onClick={() => setStep('meters')} className="px-4 py-2 text-sm bg-stone-800 dark:bg-stone-600 text-white rounded-lg">Weiter</button>
            </div>
          </>
        )}

        {step === 'meters' && selectedOcc && (
          <>
            <MeterSnapshotComponent unitId={selectedOcc.unit.id!} readings={meterReadings} onChange={setMeterReadings} />
            <div className="flex gap-2">
              <button onClick={() => setStep('rooms')} className="px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg">Zurück</button>
              <button onClick={() => setStep('keys')} className="px-4 py-2 text-sm bg-stone-800 dark:bg-stone-600 text-white rounded-lg">Weiter</button>
            </div>
          </>
        )}

        {step === 'keys' && (
          <>
            <KeyHandover keys={keys} onChange={setKeys} />
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Bemerkungen</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-700 dark:text-stone-200"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('meters')} className="px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg">Zurück</button>
              <button onClick={() => setStep('signatures')} className="px-4 py-2 text-sm bg-stone-800 dark:bg-stone-600 text-white rounded-lg">Weiter</button>
            </div>
          </>
        )}

        {step === 'signatures' && (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <SignatureCanvas label="Unterschrift Vermieter" value={sigLandlord} onChange={setSigLandlord} />
              <SignatureCanvas label="Unterschrift Mieter" value={sigTenant} onChange={setSigTenant} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('keys')} className="px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded-lg">Zurück</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Protokoll speichern
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">Übergabeprotokolle</h1>
        <button
          onClick={() => setStep('setup')}
          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Neues Protokoll
        </button>
      </div>

      {!protocols || protocols.length === 0 ? (
        <Card>
          <EmptyState
            icon="🔑"
            title="Keine Protokolle"
            description="Erstellen Sie Ihr erstes Übergabeprotokoll."
            action={{ label: 'Protokoll erstellen', onClick: () => setStep('setup') }}
          />
        </Card>
      ) : (
        <Card>
          <div className="space-y-2">
            {protocols.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg border border-stone-100 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700/50"
              >
                <div className="cursor-pointer flex-1" onClick={() => setPreviewId(p.id!)}>
                  <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
                    {p.type === 'move-in' ? 'Einzug' : 'Auszug'} – {p.unitName}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {p.tenantName} | {formatDate(p.date)}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteId(p.id!)}
                  className="text-xs text-red-500 hover:text-red-700 ml-2"
                >
                  Löschen
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Protokoll löschen?"
        message="Das Übergabeprotokoll wird unwiderruflich gelöscht."
        confirmLabel="Löschen"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </div>
  );
}

function ProtocolPreview({ protocolId, onBack }: { protocolId: number; onBack: () => void }) {
  const data = useLiveQuery(async (): Promise<ProtocolContext | null> => {
    const protocol = await db.handoverProtocols.get(protocolId);
    if (!protocol) return null;

    const occ = await db.occupancies.get(protocol.occupancyId);
    if (!occ) return null;

    const tenant = await db.tenants.get(occ.tenantId);
    const unit = await db.units.get(occ.unitId);
    const property = unit ? await db.properties.get(unit.propertyId) : null;
    const landlordSetting = await db.settings.get('landlord');
    const landlord = (landlordSetting?.value as LandlordInfo) ?? null;

    const meterDetails: MeterDetail[] = [];
    for (const mr of protocol.meterReadings) {
      const meter = await db.meters.get(mr.meterId);
      if (!meter) continue;
      const meterType = await db.meterTypes.get(meter.meterTypeId);
      meterDetails.push({
        meterId: mr.meterId,
        typeName: meterType?.name ?? '–',
        typeUnit: meterType?.unit ?? '',
        serialNumber: meter.serialNumber,
        value: mr.value,
      });
    }

    return {
      protocol,
      landlord,
      propertyName: property?.name ?? '–',
      unitName: unit?.name ?? '–',
      tenantName: tenant?.name ?? '–',
      meterDetails,
    };
  }, [protocolId]);

  if (!data) {
    return <p className="text-sm text-stone-500">Lade Protokoll...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 no-print">
        <button onClick={onBack} className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700">
          ← Zurück zur Übersicht
        </button>
        <button
          onClick={() => window.print()}
          className="text-sm px-3 py-1.5 bg-stone-800 dark:bg-stone-600 text-white rounded-lg hover:bg-stone-900 dark:hover:bg-stone-500 transition-colors"
        >
          Drucken
        </button>
      </div>
      <UebergabePrint data={data} />
    </div>
  );
}
