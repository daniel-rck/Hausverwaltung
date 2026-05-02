import { Card } from '../../components/shared/Card';

export function ImpressumPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card title="Impressum">
        <div className="space-y-6 text-sm text-stone-700 dark:text-stone-200 leading-relaxed">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Bitte ersetze die mit <code>[…]</code> markierten Platzhalter durch deine
            Angaben gemäß § 5 DDG (ehemals § 5 TMG).
          </p>

          <section>
            <h3 className="font-semibold mb-2">Angaben gemäß § 5 DDG</h3>
            <p>
              [NAME]
              <br />
              [STRASSE UND HAUSNUMMER]
              <br />
              [PLZ ORT]
              <br />
              [LAND]
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Kontakt</h3>
            <p>
              Telefon: [TELEFON]
              <br />
              E-Mail: [E-MAIL]
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">
              Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
            </h3>
            <p>
              [NAME]
              <br />
              [ANSCHRIFT]
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Streitschlichtung</h3>
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung
              bereit:{' '}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
              . Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Haftung für Inhalte</h3>
            <p>
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen
              Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir
              jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
              überwachen.
            </p>
          </section>
        </div>
      </Card>
    </div>
  );
}
