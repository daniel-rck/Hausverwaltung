import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteWithTombstone } from '../../db';
import { useProperty } from '../../hooks/useProperty';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
  Wizard,
  useConfirm,
  useToast,
} from '../../components/ui';
import { PageHeader } from '../../components/layout/PageHeader';
import { Building2, KeyRound, Plus } from '../../components/ui/icons';
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

const WIZARD_STEPS: { id: Step; label: string }[] = [
  { id: 'setup', label: 'Grunddaten' },
  { id: 'rooms', label: 'Räume' },
  { id: 'meters', label: 'Zähler' },
  { id: 'keys', label: 'Schlüssel' },
  { id: 'signatures', label: 'Unterschriften' },
];

export function UebergabePage() {
  const { activeProperty, addProperty } = useProperty();
  const [step, setStep] = useState<Step>('list');
  const toast = useToast();
  const confirm = useConfirm();

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
        icon={<Building2 size={24} strokeWidth={1.75} />}
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
    try {
      await db.handoverProtocols.add(protocol as HandoverProtocol);
      toast.success('Übergabeprotokoll gespeichert.');
      resetForm();
    } catch (err) {
      toast.error('Speichern fehlgeschlagen.');
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Protokoll löschen?',
      message: 'Das Übergabeprotokoll wird unwiderruflich gelöscht.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    await deleteWithTombstone('handoverProtocols', id);
    toast.success('Protokoll gelöscht.');
  };

  const selectedOcc = occupancies?.find((o) => o.occupancy.id === selectedOccId);

  if (previewId) {
    return <ProtocolPreview protocolId={previewId} onBack={() => setPreviewId(null)} />;
  }

  if (step !== 'list') {
    const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);
    return (
      <div className="space-y-4">
        <PageHeader
          title="Neues Übergabeprotokoll"
          icon={<KeyRound size={20} strokeWidth={1.75} />}
          accent="uebergabe"
          actions={
            <Button variant="ghost" size="sm" onClick={resetForm}>
              ← Abbrechen
            </Button>
          }
        />

        <Wizard
          steps={WIZARD_STEPS}
          current={stepIndex}
          accent="uebergabe"
          ariaLabel="Schritte Übergabeprotokoll"
        />

        {step === 'setup' && (
          <Card title="Grunddaten" accent="uebergabe">
            <div className="space-y-3">
              <FormField label="Belegung" required>
                <Select
                  value={selectedOccId ?? ''}
                  onChange={(e) => setSelectedOccId(Number(e.target.value) || null)}
                >
                  <option value="">Bitte wählen</option>
                  {occupancies?.map((o) => (
                    <option key={o.occupancy.id} value={o.occupancy.id}>
                      {o.unit.name} – {o.tenant?.name ?? 'Unbekannt'} ({o.occupancy.from} bis {o.occupancy.to ?? 'heute'})
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Art">
                <Select
                  value={protocolType}
                  onChange={(e) => setProtocolType(e.target.value as 'move-in' | 'move-out')}
                >
                  <option value="move-in">Einzug</option>
                  <option value="move-out">Auszug</option>
                </Select>
              </FormField>
              <FormField label="Datum">
                <Input
                  type="date"
                  value={protocolDate}
                  onChange={(e) => setProtocolDate(e.target.value)}
                />
              </FormField>
              <Button
                variant="primary"
                accent="uebergabe"
                onClick={() => selectedOccId && setStep('rooms')}
                disabled={!selectedOccId}
              >
                Weiter
              </Button>
            </div>
          </Card>
        )}

        {step === 'rooms' && (
          <>
            <RoomInspection rooms={rooms} onChange={setRooms} />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('setup')}>
                Zurück
              </Button>
              <Button variant="primary" accent="uebergabe" onClick={() => setStep('meters')}>
                Weiter
              </Button>
            </div>
          </>
        )}

        {step === 'meters' && selectedOcc && (
          <>
            <MeterSnapshotComponent unitId={selectedOcc.unit.id!} readings={meterReadings} onChange={setMeterReadings} />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('rooms')}>
                Zurück
              </Button>
              <Button variant="primary" accent="uebergabe" onClick={() => setStep('keys')}>
                Weiter
              </Button>
            </div>
          </>
        )}

        {step === 'keys' && (
          <>
            <KeyHandover keys={keys} onChange={setKeys} />
            <FormField label="Bemerkungen">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </FormField>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('meters')}>
                Zurück
              </Button>
              <Button variant="primary" accent="uebergabe" onClick={() => setStep('signatures')}>
                Weiter
              </Button>
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
              <Button variant="secondary" onClick={() => setStep('keys')}>
                Zurück
              </Button>
              <Button variant="primary" accent="uebergabe" onClick={handleSave}>
                Protokoll speichern
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <PageHeader
        title="Übergabeprotokolle"
        description="Einzugs- und Auszugsprotokolle erstellen, drucken und archivieren."
        icon={<KeyRound size={20} strokeWidth={1.75} />}
        accent="uebergabe"
        actions={
          <Button
            variant="primary"
            onClick={() => setStep('setup')}
            leftIcon={<Plus size={14} strokeWidth={2} />}
          >
            Neues Protokoll
          </Button>
        }
      />

      {!protocols || protocols.length === 0 ? (
        <Card>
          <EmptyState
            icon={<KeyRound size={24} strokeWidth={1.75} />}
            title="Keine Protokolle"
            description="Erstelle dein erstes Übergabeprotokoll."
            action={{ label: 'Protokoll erstellen', onClick: () => setStep('setup') }}
          />
        </Card>
      ) : (
        <Card>
          <ul className="space-y-2">
            {protocols.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
              >
                <button
                  type="button"
                  onClick={() => setPreviewId(p.id!)}
                  className="flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-lg"
                >
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {p.type === 'move-in' ? 'Einzug' : 'Auszug'} – {p.unitName}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {p.tenantName} | {formatDate(p.date)}
                  </p>
                </button>
                <Button variant="link" size="sm" onClick={() => handleDelete(p.id!)} className="text-red-500">
                  Löschen
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
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
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Lade Protokoll...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 no-print">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Zurück zur Übersicht
        </Button>
        <Button variant="primary" onClick={() => window.print()}>
          Drucken
        </Button>
      </div>
      <UebergabePrint data={data} />
    </div>
  );
}
