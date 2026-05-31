# Claude-Code-Hinweise für Hausverwaltung

Open-Source-Web-App für private Vermieter kleiner Mehrfamilienhäuser. Local-First
(IndexedDB), optionaler Ende-zu-Ende-verschlüsselter Multi-Device-Sync über einen
Cloudflare Worker (R2 + KV).

## Foundation: web-base

Diese App wird auf die gemeinsame Foundation **[`daniel-rck/web-base`](https://github.com/daniel-rck/web-base)**
migriert. Die dortigen `docs/specs/` sind die maßgebliche Quelle für Konventionen,
Tooling und Layout-System. Bei ungeklärten Entscheidungen die minimale, zu den
bestehenden Mustern passende Variante wählen.

## Quality Gates

Vor jedem Commit grün halten:

```bash
bun run lint        # Biome (check)
bun run format      # Biome (format --write)
bun run typecheck   # tsc (App + Worker)
bun run test:run    # Vitest
bun run build       # SPA + Worker-Dry-Run via CI
```

## Konventionen (gemäß web-base)

- **Bun** als Runtime & Package-Manager (kein npm/yarn-Lockfile).
- **Biome** für Lint + Format (ersetzt ESLint/Prettier) — eine Config, `biome.json`.
- **TypeScript strict**; `verbatimModuleSyntax` (→ `import type`), `any` vermeiden
  (lieber `unknown`), Non-Null-Assertions nur mit Begründung.
- `type`-Deklarationen statt `interface`, außer Declaration-Merging nötig.
- **Lokale Daten zuerst** via IndexedDB; `localStorage` nur für Settings.
- **DSGVO by design**: clientseitige AES-GCM-Verschlüsselung für Sync.
- **Deutsche UI, englischer Quellcode** (Bezeichner/Kommentare englisch).

## Architektur (aktuell)

SPA unter `src/` — Module in `src/modules/`, Dexie-Schema in `src/db/`, Sync-Client
in `src/sync/`. Cloudflare Worker (`worker/`) routet `/api/*` an die Sync-Handler und
liefert sonst die statischen Assets. Sync ist clientseitig verschlüsselt; Konflikte
werden via R2-ETag (`If-Match`) aufgelöst.

> Die Migration auf die web-base-Struktur (`src/lib/{ui,db,router,sync}` +
> `src/features/`, `idb` statt Dexie, injectManifest-PWA, reusable CI) erfolgt
> phasenweise. Stand siehe offene PRs / Branch `claude/web-base-github-integration`.

## Offene Konventions-Lücken

- `noUncheckedIndexedAccess` ist noch **nicht** aktiv (≈90 Fundstellen); wird mit dem
  Typ-/Storage-Umbau (Phase 4) nachgezogen.
