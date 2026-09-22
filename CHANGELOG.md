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
