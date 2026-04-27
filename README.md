# Hausverwaltung

Kostenlose Web-App für private Vermieter kleiner Mehrfamilienhäuser.

**[Direkt starten](https://hausverwaltung.pages.dev/)**

<!-- Screenshots -->
<!--
![Dashboard](docs/screenshot-dashboard.png)
![Nebenkostenabrechnung](docs/screenshot-nebenkosten.png)
![Mieterverwaltung](docs/screenshot-mieter.png)
-->

---

## Was ist das?

Hausverwaltung hilft dir, dein Mietobjekt einfach und übersichtlich zu verwalten — direkt im Browser, ohne Installation, ohne Registrierung, ohne monatliche Kosten.

Die App ist gemacht für Vermieter mit 3 bis 10 Wohneinheiten, die ihre Verwaltung unkompliziert selbst erledigen möchten.

## Funktionen

- **Mieterverwaltung** — Wohnungen, Mieter und Belegungszeiträume auf einen Blick
- **Nebenkostenabrechnung** — Jährliche Abrechnung mit Verteilungsschlüsseln, druckfertig für deine Mieter
- **Versorger & Verbrauch** — Wasser, Gas, Strom, Fernwärme: Rechnungen erfassen, Verbrauch analysieren, Anomalien erkennen
- **Zählerstand-Erfassung** — Alle Zähler an einem Ort, mit Eichfrist-Erinnerung
- **Mieteinnahmen** — Soll/Ist-Vergleich, offene Posten, Mahnwesen, Jahresübersicht
- **Steuer-Export** — Anlage V Übertragungshilfe für ELSTER mit automatisch berechneten Zeilen
- **Instandhaltung** — Reparaturen, Wartungen und wiederkehrende Aufgaben verwalten
- **Übergabeprotokoll** — Ein-/Auszugsprotokolle mit Raumzustand, Zählerständen und Unterschrift
- **Renditeberechnung** — Brutto-/Nettomietrendite, Cashflow und Eigenkapitalrendite
- **Mieterhöhung** — Miethistorie mit Begründung, automatische Aktualisierung der Belegungsdaten
- **Kautionsverwaltung** — Einzahlung, Verzinsung, Abzüge, Erstattung mit Fristüberwachung
- **Mietspiegel-Vergleich** — Kaltmiete/m² vs. ortsübliche Vergleichsmiete mit Ampel
- **Mietvertrag-Generator** — Druckbare Vorlage vorausgefüllt mit deinen Stammdaten
- **Dokumenten-Ablage** — PDFs und Fotos direkt in der App speichern (bis 5 MB pro Datei)
- **Dark Mode** — Helles und dunkles Design, per Klick umschaltbar

## Deine Daten gehören dir

- Alle Daten bleiben **lokal in deinem Browser** gespeichert — es werden keine Daten an einen fremden Server gesendet
- Kein Account, keine Registrierung, keine E-Mail-Adresse nötig
- **Backup per JSON-Datei** — jederzeit exportieren und auf einem anderen Gerät importieren
- **Transfer per Link** — Daten komprimiert als URL teilen, z.B. vom PC aufs Tablet
- **Multi-Device-Sync** — optional: synchronisiere zwischen mehreren Geräten ohne Konto (siehe unten)
- **Installierbar** — als App auf dem Homescreen deines Handys (PWA)

### Multi-Device-Sync einrichten

Wenn du die Hausverwaltung auf mehreren Geräten (z.B. Laptop + Handy) nutzt,
kannst du den Sync direkt in der App aktivieren — **ohne Konto, ohne E-Mail,
ohne Passwort**. Beim ersten „Sync aktivieren"-Klick wird auf dem Gerät ein
zufälliges Sync-Geheimnis erzeugt, das im Browser gespeichert bleibt. Die
Daten werden in einer einzigen verschlüsselten Datei im Sync-Backend abgelegt;
der Server kennt das Sync-Geheimnis nie im Klartext.

**Weiteres Gerät verknüpfen (auf Gerät A):**

1. Einstellungen → Sync → „Weiteres Gerät verknüpfen" — ein 6-stelliger Code
   wird angezeigt (5 Minuten gültig).
2. Auf Gerät B → „Mit anderem Gerät verknüpfen" → Code eintippen.
3. Beide Geräte synchronisieren ab sofort denselben Datenbestand.

Der Code ist **einmalig** und läuft ab — auch wenn er nicht eingelöst wurde.
Während der Übertragung wird das Sync-Geheimnis client-seitig mit einem aus
dem Code abgeleiteten Schlüssel (HKDF-SHA256 → AES-GCM) verschlüsselt; der
Server relayed nur den Chiffretext.

**Selbst deployen auf Cloudflare Pages:**

1. Repo forken und in [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages)
   verbinden. Build-Command: `npm ci --legacy-peer-deps && npm run build`,
   Output-Verzeichnis: `dist`.
2. R2-Bucket anlegen: `wrangler r2 bucket create hausverwaltung-sync` (plus
   `hausverwaltung-sync-preview` für Preview-Builds).
3. KV-Namespace anlegen: `wrangler kv namespace create PAIR_KV`. Die
   Namespace-ID in `wrangler.toml` eintragen (Prod- und Preview-ID).
4. Im Cloudflare-Pages-Dashboard unter **Settings → Functions** die Bindings
   hinterlegen: `SYNC_BUCKET` → R2-Bucket, `PAIR_KV` → KV-Namespace.
5. Push auf `main` → Cloudflare baut und deployt automatisch.

Kein Client-Secret, keine Drittanbieter-Tokens, kein Account.

### Architektur des Sync-Backends

- **Speicher:** Cloudflare R2, Schlüssel `objects/<id>/data.json`. Die `<id>`
  wird aus `sha256(secret).slice(0,16)` (Crockford-base32) abgeleitet — der
  Worker führt keine User-Tabelle.
- **Konflikt-Erkennung:** R2-`ETag` mit `If-Match` (Upload) und
  `If-None-Match` (Download) — bei parallelen Edits liefert ein PUT 412 und
  der Sync-Layer merged automatisch nach.
- **Pairing:** Cloudflare KV speichert den verschlüsselten OTP-Slot mit
  TTL 300 s; nach erfolgreichem Claim wird der Slot sofort gelöscht.
- **Rate-Limit:** KV-basierte Token-Buckets, 5 `pair/create`/min, 10
  `pair/claim`/15min, 60 Daten-Operationen/min pro IP.

## So funktioniert's

1. Öffne **[hausverwaltung.pages.dev](https://hausverwaltung.pages.dev/)**
2. Leg dein erstes Mietobjekt an (Name, Adresse)
3. Füg Wohnungen und Mieter hinzu
4. Fertig — alle Module (Nebenkosten, Zähler, Finanzen, ...) greifen automatisch auf diese Daten zu

**Tipp:** Mach regelmäßig ein Backup über den Export-Button auf dem Dashboard.

## Drucken

Abrechnungen, Mietverträge, Mahnungen und Übergabeprotokolle können direkt aus der App als saubere A4-Seiten gedruckt oder als PDF gespeichert werden (über die Druckfunktion deines Browsers).

## Technische Hinweise

- Funktioniert in allen modernen Browsern (Chrome, Firefox, Safari, Edge)
- Responsive — nutzbar auf Handy, Tablet und Desktop
- Nach dem ersten Laden auch **offline** nutzbar (PWA mit Service Worker)
- Kostenlos und quelloffen (MIT-Lizenz)

## Fragen oder Probleme?

Erstell ein [Issue](https://github.com/daniel-rck/Hausverwaltung/issues) hier auf GitHub.
