# Changelog

Alle nennenswerten Änderungen werden hier dokumentiert.
Format basiert auf [Keep a Changelog 1.1.0](https://keepachangelog.com/de/1.1.0/),
Versionierung folgt [SemVer](https://semver.org/lang/de/).

## [Unreleased]

### Hinzugefügt

- Hybrid-README mit Badges (CI, MIT, Live-Demo, Stack).
- `CONTRIBUTING.md` — Dev-Setup, Code-Style, PR-Prozess.
- `SECURITY.md` — Vulnerability-Reporting und Security-Modell.
- `CHANGELOG.md` — dieses Dokument.
- Issue- und PR-Templates unter `.github/`.
- `Callout`-Primitive, Button-Variante `dangerGhost`, Status-Text-Tokens
  (`text-success-fg` …), Chart-Wertformat `valueFormat="euro"` (de-DE).
- Eigene Fehlerseiten: „Seite nicht gefunden" für unbekannte Adressen und
  „Etwas ist schiefgelaufen" bzw. „Neue Version verfügbar – neu laden", wenn
  ein Modul nach einem Update nicht mehr lädt. Navigation bleibt dabei nutzbar.
- Sicherheits-Header (Content-Security-Policy, HSTS, `X-Frame-Options` …) für
  alle ausgelieferten Dateien.

### Behoben

- Sync: Bearbeiten von Einheiten, Zählern, Wartungen, Zahlungen und Objekten
  erzeugte neue `syncId`s → Duplikate bzw. dauerhaft abbrechender Sync;
  offline doppelt erfasste Zahlungen/Belegungen werden per LWW aufgelöst.
- Zahleneingabe: Werte wie `3,875` wurden beim Verlassen des Felds ×1000
  genommen; „1.234,56" in Mieter-/Einheitenformularen als 1,234 gelesen.
- Mieterhöhungen galten rückwirkend für alle Vormonate (falsche offene
  Posten und Mahnungen); §558-15-Monats-Frist gilt für jede Erhöhung.
- Nebenkosten: Leerstand trägt der Vermieter; Vorauszahlungen in ganzen
  Monaten; Cent-genaue Summen.
- Wasser: Jahresverbrauch bei Ablesung zum 31.12. war 0.
- Objekt-Löschung ließ Gemeinschafts-Wartungen zurück; Kaution zählte Zinsen
  als Einzahlung; UTC-Datum lieferte nachts den Vortag; Primär-Buttons und
  Fokus-Ringe hatten unter Tailwind 4 keine Farbe.

### Geändert

- Neue Akzentfarbe Indigo (Farbton 280 statt 250, deutlich vom Info-Blau
  abgesetzt); Browser-Leiste und installierte App in `#524bc2`. Akzent- und
  Status-Farben kommen aus den kontraststärkeren web-base-Tokens (WCAG AA).
- Updates warten auf den Nutzer: eine neue Version lädt erst nach „Jetzt laden"
  im Hinweis, statt sich unter offenen Seiten zu aktivieren (verlorene
  Modul-Dateien nach einem Deploy). Offene Tabs prüfen stündlich auf Updates.
- Tastatur-Fokus als echte Umrandung statt Schatten-Ring — bleibt im
  Windows-Kontrastmodus sichtbar.
- Ein neueres Datenbank-Schema in einem anderen Tab blockiert nicht mehr: der
  alte Tab schließt seine Verbindung und lädt neu.
- Unbekannte Adressen leiten nicht mehr still auf die Übersicht um, sondern
  zeigen „Seite nicht gefunden".
- Entwicklung: Lint/Format mit oxlint + oxfmt statt Biome; Basis
  [web-base](https://github.com/daniel-rck/web-base) 0.6.0.
- Alle Module auf Design-Tokens und Primitives migriert (Dark Mode),
  Rückfragen vor jedem Löschen, Formularvalidierung mit Fehlermeldungen,
  Modals, Skeletons, beschriftete Controls, „Dashboard" → „Übersicht".
- Abhängigkeiten auf aktuelle Patch-/Minor-Versionen.

## [0.1.0] — geplant

Erste öffentliche Version:

- 11 Module: Dashboard, Mieter, Nebenkosten, Zähler, Wasser/Versorger,
  Finanzen, Instandhaltung, Übergabe, Rendite, Einstellungen, Datenschutz.
- Lokale Speicherung via Dexie/IndexedDB, optionaler verschlüsselter
  Multi-Device-Sync via Cloudflare Workers + R2 + KV.
- PWA mit Service Worker, Offline-Support, Dark Mode.
- Druckbare A4-Layouts für Abrechnungen, Mietverträge, Mahnungen,
  Übergabeprotokolle.

[Unreleased]: https://github.com/daniel-rck/Hausverwaltung/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/daniel-rck/Hausverwaltung/releases/tag/v0.1.0
