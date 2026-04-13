import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { formatEuro, formatArea, formatMonth } from '../../utils/format';
import type { Occupancy, Unit, Tenant, LandlordInfo } from '../../db/schema';

interface ContractTemplateProps {
  occupancy: Occupancy;
  unit: Unit;
  tenant: Tenant;
}

export function ContractTemplate({ occupancy, unit, tenant }: ContractTemplateProps) {
  const landlord = useLiveQuery(async () => {
    const setting = await db.settings.get('landlord');
    return (setting?.value as LandlordInfo) ?? null;
  });

  const property = useLiveQuery(async () => {
    const props = await db.properties.toArray();
    return props.find((p) => p.id === unit.propertyId) ?? null;
  }, [unit.propertyId]);

  if (landlord === undefined || property === undefined) return null;

  const totalRent = occupancy.rentCold + occupancy.rentUtilities;

  return (
    <div>
      {/* Print button – hidden when printing */}
      <div className="no-print mb-4 flex justify-end">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm bg-stone-800 dark:bg-stone-600 text-white rounded-lg hover:bg-stone-900 dark:hover:bg-stone-500 transition-colors"
        >
          Vertrag drucken
        </button>
      </div>

      {/* A4 contract content – always light background for print */}
      <div className="bg-white text-stone-900 max-w-[210mm] mx-auto p-10 print:p-0 text-sm leading-relaxed border border-stone-200 dark:border-stone-700 print:border-none shadow-sm print:shadow-none">
        {/* Header */}
        <h1 className="text-2xl font-bold text-center mb-8 tracking-wide">
          MIETVERTRAG
        </h1>

        <p className="mb-6 text-center text-xs text-stone-500">
          zwischen den nachstehend genannten Vertragsparteien
        </p>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="font-semibold mb-1">Vermieter:</p>
            <p>{landlord?.name ?? '________________________'}</p>
            <p>{landlord?.address ?? '________________________'}</p>
            {landlord?.taxId && (
              <p className="text-xs text-stone-500 mt-1">
                Steuer-Nr.: {landlord.taxId}
              </p>
            )}
          </div>
          <div>
            <p className="font-semibold mb-1">Mieter:</p>
            <p>{tenant.name}</p>
            {tenant.email && <p className="text-xs text-stone-500">{tenant.email}</p>}
            {tenant.phone && <p className="text-xs text-stone-500">{tenant.phone}</p>}
          </div>
        </div>

        <hr className="my-6 border-stone-300" />

        {/* §1 Mietgegenstand */}
        <Section number={1} title="Mietgegenstand">
          <p>
            Der Vermieter vermietet dem Mieter die nachstehend bezeichnete Wohnung
            in dem Anwesen:
          </p>
          <div className="mt-2 pl-4 border-l-2 border-stone-300">
            <p>
              <strong>Anschrift:</strong>{' '}
              {property?.address ?? '________________________'}
            </p>
            <p>
              <strong>Wohneinheit:</strong> {unit.name}
            </p>
            <p>
              <strong>Wohnfläche:</strong> ca. {formatArea(unit.area)}
            </p>
            {unit.floor && (
              <p>
                <strong>Stockwerk:</strong> {unit.floor}
              </p>
            )}
          </div>
          <p className="mt-2">
            Die Wohnung wird zu Wohnzwecken vermietet. Eine gewerbliche oder
            teilgewerbliche Nutzung bedarf der vorherigen schriftlichen Zustimmung
            des Vermieters.
          </p>
        </Section>

        {/* §2 Mietdauer */}
        <Section number={2} title="Mietdauer">
          <p>
            Das Mietverhältnis beginnt am{' '}
            <strong>{formatMonth(occupancy.from)}</strong> und läuft auf
            unbestimmte Zeit (unbefristet).
          </p>
        </Section>

        {/* §3 Miete */}
        <Section number={3} title="Miete">
          <p>Die monatliche Miete setzt sich wie folgt zusammen:</p>
          <table className="mt-2 w-full max-w-md text-sm">
            <tbody>
              <tr>
                <td className="py-1">Nettokaltmiete (Grundmiete):</td>
                <td className="py-1 text-right font-mono font-medium">
                  {formatEuro(occupancy.rentCold)}
                </td>
              </tr>
              <tr>
                <td className="py-1">
                  Vorauszahlung auf Betriebs- und Nebenkosten:
                </td>
                <td className="py-1 text-right font-mono font-medium">
                  {formatEuro(occupancy.rentUtilities)}
                </td>
              </tr>
              <tr className="border-t border-stone-300 font-semibold">
                <td className="py-1">Gesamtmiete (monatlich):</td>
                <td className="py-1 text-right font-mono">
                  {formatEuro(totalRent)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3">
            Die Miete ist monatlich im Voraus, spätestens bis zum 3. Werktag eines
            jeden Monats, auf das vom Vermieter benannte Konto zu überweisen.
          </p>
          {landlord?.iban && (
            <p className="mt-1">
              <strong>IBAN:</strong> {landlord.iban}
            </p>
          )}
          <p className="mt-2">
            Über die Vorauszahlungen auf die Betriebskosten wird jährlich
            abgerechnet. Nachzahlungen und Guthaben werden mit der auf die
            Abrechnung folgenden Mietzahlung verrechnet.
          </p>
        </Section>

        {/* §4 Kaution */}
        <Section number={4} title="Kaution">
          <p>
            Der Mieter leistet eine Mietkaution in Höhe von{' '}
            <strong>{formatEuro(occupancy.deposit)}</strong>.
          </p>
          <p className="mt-2">
            Die Kaution kann in drei gleichen monatlichen Raten gezahlt werden. Die
            erste Rate ist zu Beginn des Mietverhältnisses fällig. Der Vermieter
            hat die Kaution getrennt von seinem Vermögen bei einem Kreditinstitut
            zum üblichen Zinssatz anzulegen. Die Zinsen stehen dem Mieter zu.
          </p>
          <p className="mt-2">
            Die Kaution dient der Sicherung aller Ansprüche des Vermieters aus dem
            Mietverhältnis. Die Rückzahlung erfolgt nach Beendigung des
            Mietverhältnisses und nach Ablauf einer angemessenen Prüfungsfrist, in
            der Regel innerhalb von sechs Monaten.
          </p>
        </Section>

        {/* §5 Schönheitsreparaturen */}
        <Section number={5} title="Schönheitsreparaturen">
          <p>
            Die Schönheitsreparaturen obliegen dem Mieter. Zu den
            Schönheitsreparaturen gehören insbesondere das Tapezieren, Anstreichen
            oder Kalken der Wände und Decken, das Streichen der Heizkörper
            einschließlich der Heizrohre, der Innentüren sowie der Fenster und
            Außentüren von innen.
          </p>
          <p className="mt-2">
            Schönheitsreparaturen sind fachgerecht und in neutralen, hellen,
            deckenden Farben auszuführen. Bei Beendigung des Mietverhältnisses sind
            fällige Schönheitsreparaturen nachzuholen.
          </p>
        </Section>

        {/* §6 Kündigungsfrist */}
        <Section number={6} title="Kündigungsfrist">
          <p>
            Die Kündigung des Mietverhältnisses ist für beide Vertragsparteien mit
            einer Frist von <strong>drei Monaten zum Monatsende</strong> zulässig.
            Die Kündigung bedarf der Schriftform. Maßgeblich ist der Zugang des
            Kündigungsschreibens.
          </p>
          <p className="mt-2">
            Das Recht zur fristlosen Kündigung aus wichtigem Grund gemäß den
            gesetzlichen Vorschriften bleibt hiervon unberührt.
          </p>
        </Section>

        {/* §7 Hausordnung */}
        <Section number={7} title="Hausordnung">
          <p>
            Die als Anlage beigefügte Hausordnung ist Bestandteil dieses
            Mietvertrags. Der Mieter verpflichtet sich, die Hausordnung
            einzuhalten und dafür Sorge zu tragen, dass auch die zu seinem
            Haushalt gehörenden Personen und seine Besucher die Hausordnung
            beachten.
          </p>
          <p className="mt-2">
            Insbesondere ist darauf zu achten, dass die allgemein übliche
            Nachtruhe (22:00 bis 6:00 Uhr) sowie die Mittagsruhe (13:00 bis
            15:00 Uhr) eingehalten wird. Die Reinigung gemeinschaftlich genutzter
            Flächen (Treppenhaus, Flur) erfolgt im wöchentlichen Wechsel durch die
            Mieter.
          </p>
        </Section>

        {/* §8 Sonstiges */}
        <Section number={8} title="Sonstiges">
          <p>
            Mündliche Nebenabreden bestehen nicht. Änderungen und Ergänzungen
            dieses Vertrags bedürfen der Schriftform.
          </p>
          <p className="mt-2">
            Sollte eine Bestimmung dieses Vertrags unwirksam sein oder werden, so
            bleibt die Wirksamkeit der übrigen Bestimmungen hiervon unberührt. An
            die Stelle der unwirksamen Bestimmung tritt eine Regelung, die dem
            wirtschaftlichen Zweck der unwirksamen Bestimmung am nächsten kommt.
          </p>
          {occupancy.notes && (
            <div className="mt-3 p-3 border border-stone-300 rounded">
              <p className="text-xs font-semibold mb-1">Besondere Vereinbarungen:</p>
              <p>{occupancy.notes}</p>
            </div>
          )}
        </Section>

        {/* Signatures */}
        <div className="mt-16">
          <p className="mb-12">
            _________________________, den _________________________
          </p>
          <div className="grid grid-cols-2 gap-12">
            <div>
              <div className="border-t border-stone-900 pt-2">
                <p className="text-xs text-stone-500">
                  Vermieter: {landlord?.name ?? ''}
                </p>
              </div>
            </div>
            <div>
              <div className="border-t border-stone-900 pt-2">
                <p className="text-xs text-stone-500">
                  Mieter: {tenant.name}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h2 className="font-bold mb-2">
        &sect;{number} {title}
      </h2>
      {children}
    </div>
  );
}
