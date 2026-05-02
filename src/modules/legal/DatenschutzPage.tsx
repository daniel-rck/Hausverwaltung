import { Card } from '../../components/shared/Card';

export function DatenschutzPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card title="Datenschutzerklärung">
        <div className="space-y-6 text-sm text-stone-700 dark:text-stone-200 leading-relaxed">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Bitte ersetze die mit <code>[…]</code> markierten Platzhalter durch deine Angaben und
            lass den Text vor Veröffentlichung rechtlich prüfen. Dieser Text ist eine
            Vorlage und keine Rechtsberatung.
          </p>

          <section>
            <h3 className="font-semibold mb-2">1. Verantwortlicher</h3>
            <p>
              Verantwortlich für die Datenverarbeitung im Sinne von Art. 4 Nr. 7 DSGVO ist:
            </p>
            <p className="mt-2">
              [NAME]
              <br />
              [ANSCHRIFT]
              <br />
              E-Mail: [E-MAIL]
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">2. Lokale Datenverarbeitung im Browser</h3>
            <p>
              Die Hausverwaltungs-Anwendung ist eine Progressive Web App (PWA). Sämtliche
              Stamm- und Bewegungsdaten (Mieter, Nebenkosten, Zähler, Finanzen etc.) werden
              ausschließlich lokal in deinem Browser in einer IndexedDB-Datenbank gespeichert.
              Diese Daten verlassen dein Gerät nur, wenn du den optionalen Geräte-Sync
              aktivierst (siehe Abschnitt 3) oder Daten manuell exportierst.
            </p>
            <p className="mt-2">
              Zusätzlich registriert die App einen Service Worker, der statische Programmdateien
              für die Offline-Nutzung im Browser zwischenspeichert. Es werden keine Cookies und
              keine Tracking-Technologien eingesetzt.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">3. Optionaler Geräte-Sync über Cloudflare</h3>
            <p>
              Wenn du den Geräte-Sync nutzt, werden Daten an Cloudflare, Inc. (101 Townsend St,
              San Francisco, CA 94107, USA) als Auftragsverarbeiter übermittelt. Mit Cloudflare
              besteht ein Auftragsverarbeitungsvertrag (AVV / DPA) inklusive der EU-Standard­
              vertragsklauseln gemäß Art. 46 Abs. 2 lit. c DSGVO.
            </p>
            <p className="mt-2 font-medium">
              Konkret werden folgende Daten verarbeitet:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Server-Logs (Cloudflare):</strong> IP-Adresse, User-Agent, Zeitstempel
                und Request-URL. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
                Interesse an Betriebs- und Angriffssicherheit).
              </li>
              <li>
                <strong>Pairing-Codes (Cloudflare KV):</strong> Beim Koppeln eines neuen Geräts
                wird ein 6-stelliger Einmal-Code zusammen mit einem clientseitig verschlüsselten
                Schlüsselmaterial für maximal 5 Minuten in Cloudflare KV gespeichert und nach
                Abruf bzw. Ablauf gelöscht.
              </li>
              <li>
                <strong>Synchronisierte Nutzdaten (Cloudflare R2):</strong> Deine Verwaltungsdaten
                werden vor der Übertragung in deinem Browser Ende-zu-Ende verschlüsselt
                (AES-GCM). Cloudflare speichert ausschließlich den verschlüsselten Datenblob;
                der Schlüssel verlässt deine Geräte nicht.
              </li>
            </ul>
            <p className="mt-2">
              Rechtsgrundlage für den Sync ist Art. 6 Abs. 1 lit. b DSGVO (Erfüllung der
              gewünschten Funktion). Du kannst den Sync jederzeit beenden und die Daten in
              Cloudflare R2 löschen lassen.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">4. Hosting der Anwendung</h3>
            <p>
              Die App selbst (HTML, JavaScript, CSS) wird über Cloudflare Pages bzw. Cloudflare
              Workers ausgeliefert. Beim Aufruf werden in den Server-Logs von Cloudflare die
              unter Abschnitt 3 genannten Verbindungsdaten verarbeitet.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">5. Google Fonts</h3>
            <p>
              Die App lädt Schriftarten von Google Fonts (Google Ireland Limited, Gordon House,
              Barrow Street, Dublin 4, Irland). Beim ersten Aufruf wird deine IP-Adresse an
              Google übertragen; danach werden die Schriftarten lokal im Browser gecached.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (einheitliche Darstellung).
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">6. Empfänger und Drittlandtransfer</h3>
            <p>
              Eine Übermittlung in Drittländer (USA) findet im Rahmen der unter Abschnitt 3 und
              5 genannten Dienste statt. Cloudflare und Google sind unter dem EU-US Data
              Privacy Framework zertifiziert; ergänzend kommen die EU-Standardvertragsklauseln
              zur Anwendung.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">7. Speicherdauer</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Lokale IndexedDB: bis du sie selbst löschst.</li>
              <li>Pairing-Codes in Cloudflare KV: maximal 5 Minuten.</li>
              <li>
                Verschlüsselte Sync-Daten in Cloudflare R2: solange der Sync aktiv ist; nach
                Beendigung auf Anfrage gelöscht.
              </li>
              <li>Cloudflare Server-Logs: gemäß Cloudflare-Vorgaben (i.&nbsp;d.&nbsp;R. wenige Tage).</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-2">8. Deine Rechte</h3>
            <p>
              Dir stehen die Rechte auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO),
              Löschung (Art. 17 DSGVO), Einschränkung (Art. 18 DSGVO), Datenübertragbarkeit
              (Art. 20 DSGVO) und Widerspruch (Art. 21 DSGVO) zu. Außerdem hast du das Recht,
              dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO).
            </p>
            <p className="mt-2">Anfragen richte bitte an: [E-MAIL]</p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">9. Änderungen</h3>
            <p>
              Diese Datenschutzerklärung kann angepasst werden, wenn sich Funktionen oder
              Rechtslage ändern. Stand: [DATUM].
            </p>
          </section>
        </div>
      </Card>
    </div>
  );
}
