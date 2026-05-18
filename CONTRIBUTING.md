# Mitmachen

Schön, dass du beitragen möchtest! Egal ob Bug-Report, Feature-Idee oder Code —
jede Hilfe ist willkommen. Diese Seite fasst zusammen, wie du am schnellsten
zum Ziel kommst.

## Bug gefunden?

Mach ein [Issue auf GitHub](https://github.com/daniel-rck/Hausverwaltung/issues/new/choose)
mit dem **Bug-Report-Template**. Wichtig sind:

- Schritte zur Reproduktion (möglichst minimal)
- Erwartetes vs. tatsächliches Verhalten
- Browser + Version, Gerät
- Konsolen-Fehler (DevTools → Console → Copy)
- Ist Sync aktiv?

## Feature-Idee?

Mach erst ein Issue mit dem **Feature-Request-Template**, damit wir die Idee
kurz diskutieren können — bevor du Zeit in einen PR investierst.

## Lokale Entwicklung

```bash
git clone https://github.com/daniel-rck/Hausverwaltung.git
cd Hausverwaltung
bun install

bun dev                  # SPA auf http://localhost:5173
bun dev:cf               # Worker + SPA gemeinsam (für Sync-Tests)
bun test                 # Vitest im Watch-Modus
bun run lint
bun run typecheck
```

Voraussetzung: [Bun 1.3+](https://bun.sh).

## Code-Style

- **TypeScript strict** — keine `any` ohne Begründung.
- **ESLint** entscheidet — `bun run lint` muss grün sein.
- Lokale Komponenten landen unter `src/modules/<modul>/`, geteilte UI unter
  `src/components/ui/`.
- Bei neuen DB-Tabellen / Schema-Änderungen: Migration in `src/db/` ergänzen
  und Versions-Bump im Dexie-Schema dokumentieren.

## Tests

Wenn du ein Modul anfasst, schreib mindestens einen Smoke-Test (`*.test.ts(x)`
im selben Ordner). Vitest läuft unter jsdom — die Sync-Layer-Tests laufen im
Cloudflare-Worker-Pool (siehe `vitest.config.ts`).

## Commit-Konvention

[Conventional Commits](https://www.conventionalcommits.org/) sind empfohlen,
aber nicht erzwungen:

- `feat: ...` — neues Feature
- `fix: ...` — Bugfix
- `docs: ...` — nur Dokumentation
- `refactor: ...` — Umbau ohne Verhaltens­änderung
- `chore: ...` — Build, CI, Deps

## Pull Requests

1. Branch von `main` abzweigen (`feat/...` oder `fix/...`).
2. Änderung möglichst klein halten — ein PR, ein Thema.
3. `bun run lint && bun run typecheck && bun run test:run` lokal grün.
4. PR-Template ausfüllen, Bezug zum Issue verlinken.
5. CI grün abwarten — dann reviewen wir.

## Branches & Releases

- PRs gehen gegen `main`.
- Releases (Tags) werden im [CHANGELOG.md](./CHANGELOG.md) festgehalten.

## Architektur-Spickzettel

```
src/
  modules/       11 Feature-Module (mieter, nebenkosten, zaehler, ...)
  components/    geteilte UI (layout, ui, charts, sync)
  db/            Dexie-Schema, Cascade-Deletes, Import/Export
  sync/          verschlüsselter Sync-Client (HKDF → AES-GCM)
  hooks/         React-Hooks (useTheme, useProperty, ...)
  utils/         reine Hilfsfunktionen
worker/          Cloudflare Worker (/api/* Routing, R2/KV-Handler)
```

Mehr zur Sync-Architektur: [README.md](./README.md) ·
Cloudflare-Setup: [SETUP.md](./SETUP.md) ·
Security-Modell: [SECURITY.md](./SECURITY.md)
