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
