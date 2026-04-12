import { formatDate } from '../../utils/format';
import type {
  HandoverProtocol,
  RoomCondition,
  Rating,
  LandlordInfo,
} from '../../db/schema';

interface ProtocolContext {
  protocol: HandoverProtocol;
  landlord: LandlordInfo | null;
  propertyName: string;
  unitName: string;
  tenantName: string;
  meterDetails: MeterDetail[];
}

interface MeterDetail {
  meterId: number;
  typeName: string;
  typeUnit: string;
  serialNumber: string;
  value: number;
}

interface UebergabePrintProps {
  data: ProtocolContext;
}

function ratingLabel(r: Rating): string {
  switch (r) {
    case 'good':
      return 'Gut';
    case 'fair':
      return 'Mittel';
    case 'poor':
      return 'Schlecht';
  }
}

function ratingPrintClass(r: Rating): string {
  switch (r) {
    case 'good':
      return 'text-green-700';
    case 'fair':
      return 'text-amber-700';
    case 'poor':
      return 'text-red-700';
  }
}

function RoomTable({ rooms }: { rooms: RoomCondition[] }) {
  const aspects = [
    { key: 'walls' as const, label: 'Wände' },
    { key: 'floor' as const, label: 'Boden' },
    { key: 'ceiling' as const, label: 'Decke' },
    { key: 'windows' as const, label: 'Fenster' },
    { key: 'doors' as const, label: 'Türen' },
  ];

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-stone-100">
          <th className="border border-stone-300 px-2 py-1.5 text-left font-medium">
            Raum
          </th>
          {aspects.map((a) => (
            <th
              key={a.key}
              className="border border-stone-300 px-2 py-1.5 text-center font-medium"
            >
              {a.label}
            </th>
          ))}
          <th className="border border-stone-300 px-2 py-1.5 text-left font-medium">
            Bemerkungen
          </th>
        </tr>
      </thead>
      <tbody>
        {rooms.map((room, i) => (
          <tr key={i}>
            <td className="border border-stone-300 px-2 py-1.5 font-medium">
              {room.name}
            </td>
            {aspects.map((a) => (
              <td
                key={a.key}
                className={`border border-stone-300 px-2 py-1.5 text-center ${ratingPrintClass(room[a.key])}`}
              >
                {ratingLabel(room[a.key])}
              </td>
            ))}
            <td className="border border-stone-300 px-2 py-1.5 text-stone-600">
              {room.notes || '–'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function UebergabePrint({ data }: UebergabePrintProps) {
  const { protocol, landlord, propertyName, unitName, tenantName, meterDetails } =
    data;

  const typeLabel = protocol.type === 'move-in' ? 'Einzug' : 'Auszug';

  return (
    <div className="print-only print-container font-sans text-stone-800">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">
          Übergabeprotokoll – {typeLabel}
        </h1>
        <p className="text-sm text-stone-500">
          Erstellt am {formatDate(protocol.date)}
        </p>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
        <div>
          <h2 className="font-semibold text-stone-700 mb-1">Vermieter</h2>
          {landlord ? (
            <div className="text-stone-600">
              <p>{landlord.name}</p>
              <p className="whitespace-pre-line">{landlord.address}</p>
              {landlord.taxId && <p>Steuer-Nr.: {landlord.taxId}</p>}
            </div>
          ) : (
            <p className="text-stone-400">Nicht hinterlegt</p>
          )}
        </div>
        <div>
          <h2 className="font-semibold text-stone-700 mb-1">Mieter</h2>
          <p className="text-stone-600">{tenantName}</p>
        </div>
      </div>

      {/* Object info */}
      <div className="grid grid-cols-3 gap-4 mb-6 text-sm bg-stone-50 p-3 rounded-lg border border-stone-200">
        <div>
          <span className="text-stone-500 text-xs">Objekt</span>
          <p className="font-medium">{propertyName}</p>
        </div>
        <div>
          <span className="text-stone-500 text-xs">Wohnung</span>
          <p className="font-medium">{unitName}</p>
        </div>
        <div>
          <span className="text-stone-500 text-xs">Art / Datum</span>
          <p className="font-medium">
            {typeLabel} – {formatDate(protocol.date)}
          </p>
        </div>
      </div>

      {/* Room inspection */}
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-2">Raumzustand</h2>
        <RoomTable rooms={protocol.rooms} />
      </div>

      {/* Meter readings */}
      {meterDetails.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-2">Zählerstände</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-stone-100">
                <th className="border border-stone-300 px-2 py-1.5 text-left font-medium">
                  Zählerart
                </th>
                <th className="border border-stone-300 px-2 py-1.5 text-left font-medium">
                  Zähler-Nr.
                </th>
                <th className="border border-stone-300 px-2 py-1.5 text-right font-medium">
                  Stand
                </th>
                <th className="border border-stone-300 px-2 py-1.5 text-left font-medium">
                  Einheit
                </th>
              </tr>
            </thead>
            <tbody>
              {meterDetails.map((m) => (
                <tr key={m.meterId}>
                  <td className="border border-stone-300 px-2 py-1.5">
                    {m.typeName}
                  </td>
                  <td className="border border-stone-300 px-2 py-1.5 font-mono">
                    {m.serialNumber}
                  </td>
                  <td className="border border-stone-300 px-2 py-1.5 text-right font-mono">
                    {m.value.toLocaleString('de-DE')}
                  </td>
                  <td className="border border-stone-300 px-2 py-1.5">
                    {m.typeUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Keys */}
      {protocol.keys.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-2">Schlüsselübergabe</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-stone-100">
                <th className="border border-stone-300 px-2 py-1.5 text-left font-medium">
                  Schlüsselart
                </th>
                <th className="border border-stone-300 px-2 py-1.5 text-center font-medium">
                  Anzahl
                </th>
              </tr>
            </thead>
            <tbody>
              {protocol.keys.map((k, i) => (
                <tr key={i}>
                  <td className="border border-stone-300 px-2 py-1.5">
                    {k.type}
                  </td>
                  <td className="border border-stone-300 px-2 py-1.5 text-center font-mono">
                    {k.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {protocol.notes && (
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-2">Sonstige Anmerkungen</h2>
          <p className="text-sm text-stone-600 whitespace-pre-line border border-stone-300 rounded p-3">
            {protocol.notes}
          </p>
        </div>
      )}

      {/* Signatures */}
      <div className="page-break" />
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-4">Unterschriften</h2>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-sm font-medium text-stone-700 mb-2">Vermieter</p>
            {protocol.signatures.landlord ? (
              <img
                src={protocol.signatures.landlord}
                alt="Unterschrift Vermieter"
                className="h-24 border-b border-stone-400"
              />
            ) : (
              <div className="h-24 border-b border-stone-400" />
            )}
            <p className="text-xs text-stone-500 mt-1">
              {landlord?.name ?? 'Vermieter'}
            </p>
            <p className="text-xs text-stone-400">
              Ort, Datum: ______________________
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-stone-700 mb-2">Mieter</p>
            {protocol.signatures.tenant ? (
              <img
                src={protocol.signatures.tenant}
                alt="Unterschrift Mieter"
                className="h-24 border-b border-stone-400"
              />
            ) : (
              <div className="h-24 border-b border-stone-400" />
            )}
            <p className="text-xs text-stone-500 mt-1">{tenantName}</p>
            <p className="text-xs text-stone-400">
              Ort, Datum: ______________________
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { ProtocolContext, MeterDetail };
