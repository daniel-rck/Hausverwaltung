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
- **Biome** entscheidet (Lint + Format) — `bun run lint` muss grün sein.
- Feature-Komponenten landen unter `src/features/<modul>/`, geteilte UI unter
  `src/lib/ui/`.
- Bei neuen DB-Tabellen / Schema-Änderungen: Store/Indizes in `src/lib/db/idb.ts`
  ergänzen und `DB_VERSION` bumpen (Upgrade-Pfad dort dokumentieren).

## Tests

Wenn du ein Modul anfasst, schreib mindestens einen Smoke-Test (`*.test.ts(x)`
im selben Ordner). Vitest läuft für `src/` unter Node (IndexedDB via
fake-indexeddb) — die Worker-Tests laufen im Cloudflare-Worker-Pool
(siehe `vitest.config.ts`).

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
  features/      11 Feature-Module (mieter, nebenkosten, zaehler, ...)
  lib/
    ui/          geteilte UI (layout, shared, ui, charts, sync, Theme)
    db/          idb-Engine, Query-Schicht, Cascade-Deletes, Import/Export
    sync/        verschlüsselter Sync-Client (HKDF → AES-GCM)
    hooks/       React-Hooks (useProperty, useKeyboardShortcuts, ...)
    utils/       reine Hilfsfunktionen
worker/          Cloudflare Worker (/api/* Routing, R2/KV-Handler)
```

Mehr zur Sync-Architektur: [README.md](./README.md) ·
Cloudflare-Setup: [SETUP.md](./SETUP.md) ·
Security-Modell: [SECURITY.md](./SECURITY.md)
