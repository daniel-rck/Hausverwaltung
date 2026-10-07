# Claude-Code-Hinweise für Hausverwaltung

Open-Source-Web-App für private Vermieter kleiner Mehrfamilienhäuser. Local-First
(IndexedDB), optionaler Ende-zu-Ende-verschlüsselter Multi-Device-Sync über einen
Cloudflare Worker (R2 + KV).

## Foundation: web-base

Diese App läuft auf der gemeinsamen Foundation **[`daniel-rck/web-base`](https://github.com/daniel-rck/web-base)**.
Die dortigen `docs/specs/` sind die maßgebliche Quelle für Konventionen, Tooling
und Layout-System. Bei ungeklärten Entscheidungen die minimale, zu den
bestehenden Mustern passende Variante wählen. Scaffolding & Updates über die CLI
(`bunx github:daniel-rck/web-base …`), nicht von Hand kopieren — `.github/workflows/ci.yml`
fährt den Drift-Guard `web-base-check`, wer eine *owned* Datei anfasst, bricht die CI.

## Quality Gates

Vor jedem Commit grün halten:

```bash
bun run lint        # oxlint + oxfmt --check
bun run format      # oxfmt (formatiert)
bun run typecheck   # tsc -b (App + Node + SW + Worker)
bun run test        # Vitest (run, kein Watch)
bun run build       # SPA + Worker-Dry-Run via CI
```

## Konventionen (gemäß web-base)

- **Bun** als Runtime & Package-Manager (kein npm/yarn-Lockfile).
- **oxlint + oxfmt** für Lint + Format. `oxlint.base.json` und `.oxfmtrc.json`
  kommen aus web-base und werden bei `update` überschrieben — nicht anfassen;
  app-eigene Regeln gehören in `.oxlintrc.json` (`overrides`), Format-Ausnahmen
  in `.prettierignore`. Einzelne Stellen mit
  `// oxlint-disable-next-line <regel> -- <grund>` begründen.
- **TypeScript strict**; `verbatimModuleSyntax` (→ `import type`), `any` vermeiden
  (lieber `unknown`), Non-Null-Assertions nur mit Begründung.
- `type`-Deklarationen statt `interface`, außer Declaration-Merging nötig.
- **Lokale Daten zuerst** via IndexedDB; `localStorage` nur für Settings.
- **DSGVO by design**: clientseitige AES-GCM-Verschlüsselung für Sync.
- **Deutsche UI, englischer Quellcode** (Bezeichner/Kommentare englisch).
- **Design-Tokens statt Roh-Paletten**: `bg-surface`, `text-fg-muted`,
  `border-border`, `text-danger-fg`, `text-fg-on-accent` … aus
  `src/lib/ui/tokens.css` (owned, nie editieren). `src/lib/ui/theme.css` ist die
  Naht und setzt nur `--accent-h: 280` (Indigo, `theme_color` `#524bc2` in
  `public/manifest.json` und `index.html`); app-eigene Tokens stehen in
  `src/index.css`. Neue `zinc-*`-Klassen im Chrome sind ein Review-Fehler.
  Text auf einer Status-Tönung nutzt `text-*-fg`, Text auf Akzentflächen
  `text-fg-on-accent` statt `text-white`.
- **Keine externen Asset-Hosts.** Schriften liegen als `@fontsource`-Pakete im
  Bundle; eine PWA, deren Typografie am CDN hängt, ist offline kaputt.

## Architektur (aktuell)

SPA unter `src/` in web-base-Layout: geteilte Infrastruktur in `src/lib/{ui,db,sync,hooks,utils}`,
app-spezifische Domänen in `src/features/<modul>/`. Storage ist **`idb`** (kein Dexie) —
`src/lib/db/`: `db.ts` (Naht: Schema, Name `hausverwaltung`, Version 51, Upgrade-Leiter über
web-bases `createDBOpener` aus `open.ts`), `idb.ts` (Mutations-Kanäle `dataChanged`/`localWrite`),
`table.ts` (schlanke Dexie-kompatible Query-Schicht), `useLiveQuery.ts` (reaktiver Hook).
Routen: `src/lib/router.tsx` (`createHashRouter`, Pfade in `src/lib/routes.ts`), die App-Shell
ist die Root-Layout-Route (`src/App.tsx`) mit `RouteError`, `RouteFallback` und `*` → `NotFound`.
Cloudflare Worker (`worker/index.ts`) delegiert über web-bases `routeRequest` (`worker/base.ts`):
`/api/*` an die Sync-Handler, `/healthz`, 404 für veraltete `/assets/*`, sonst die statischen
Assets. Sync ist clientseitig verschlüsselt; Konflikte werden via R2-ETag (`If-Match`) aufgelöst.

> Migrationsstand auf web-base **0.6.0**: **Tooling/oxc ✓, Struktur (`src/lib`+`src/features`) ✓,
> Storage→idb + `createDBOpener` ✓, PWA injectManifest + `registerAppShell()` +
> `registerType: "prompt"` ✓, Router (Data-Router, Layout-Route, Fehlerseiten) ✓,
> Worker `routeRequest` + SPA-Modus ✓, Testing-Setup ✓, reusable CI `@v0.6.0` ✓,
> Theme-System (`tokens.css` + `theme.css`-Naht, `--accent-h: 280`, `data-theme`) ✓.**
> `web-base check --strict` ist grün; die CI fährt `web-base-check` mit `strict: true`.
>
> Bewusste Abweichungen (App übertrifft die minimalen web-base-Scaffolds — analog zu
> web-bases Prinzip „jede App besitzt ihre Infrastruktur nach init"):
> - **Storage**: `idb` ist die Base; die App behält darüber eine schlanke Query-Schicht
>   (`where/equals/between/orderBy/…`), weil ihre 20 Stores inkl. Tombstones/Cascade/E2E-Sync
>   über das Template hinausgehen. `db.transaction` ist ein sequentieller Shim (kein
>   Crash-Rollback) — bewusster Trade-off (siehe `cascade.ts`). Die Upgrade-Leiter gleicht
>   deklarativ gegen `STORES` ab statt `if (oldVersion < N)`-Stufen. `useLiveQuery.ts` ist
>   `webBase.unmanaged` (Dexie-kompatible Signatur); die owned `mutations.ts` liegt bei, wird
>   aber nicht genutzt. **DB-Name und -Version nie ändern** — ein neuer Name leert die Daten.
> - **Router**: `createHashRouter` statt des `createBrowserRouter`-Scaffolds — wegen
>   hash-basiertem URL-Daten-Sharing (`#/import/:payload`, erreicht nie den Server) und null
>   Server-Config. Alle URLs sind dieselben wie unter dem früheren `<HashRouter>`; unbekannte
>   Pfade zeigen jetzt `NotFound` statt still auf `/` umzuleiten.
> - **Worker/Sync**: eigene, fortgeschrittene Implementierung (OTP-Pairing, R2-Snapshots mit
>   If-Match, KV, Rate-Limit), nicht drahtkompatibel mit dem `sync`-Template v2.
>   **Nie `web-base add sync` oder `web-base check sync` ausführen.** `handleApi` behält seinen
>   eigenen 500er mit Fehlertext (`internal_error:<message>`) und die 503-Diagnose bei fehlenden
>   Bindings. Follow-up aus web-base: prüfen, ob das OTP-Pairing den Wrap-Key allein aus dem OTP
>   ableitet (das Design, das das Template in 0.6.0 verworfen hat).
> - **Layout/Theme**: eigenes Design-System (~30 Komponenten unter
>   `src/lib/ui/{layout,ui,shared,charts,sync}/`), eigene `layout/AppShell.tsx`,
>   `layout/PageHeader.tsx` und `layout/Nav.tsx` statt `AppHeader`/`AppNav`. Die owned
>   web-base-Dateien direkt in `src/lib/ui/` (`AppShell`, `AppHeader`, `AppNav`, `PageHeader`,
>   `Button`, `Card`, `Badge` …) liegen nur für den Drift-Guard bei; App-Code importiert aus den
>   Unterordnern. Genutzt werden `tokens.css`, `useTheme`, `ThemeToggle`, `InstallButton` sowie
>   (in `src/lib/routing/`) die Fehlerseiten. Das Update-Toast ist die eigene
>   `layout/UpdatePrompt.tsx` über web-bases `useAppUpdate()`, gemountet in `main.tsx`.
>   Feature-Komponenten tragen teils noch `zinc-*`-Styles (schrittweise Migration auf
>   semantische Tokens). Fokus-Stile sind echte Outlines (`focus-visible:outline-2
>   focus-visible:outline-accent-500`), keine `ring`-Schatten — die verschwinden im
>   Forced-Colors-Modus.
> - **CSP** (`public/_headers`): gegenüber dem Template erweitert um
>   `connect-src https://generativelanguage.googleapis.com` (optionaler Gemini-Scan mit
>   eigenem Key) und `object-src 'self' blob:` (PDF-Vorschau als `blob:`-Tab).

## Offene Konventions-Lücken

- `noUncheckedIndexedAccess` ist in allen tsconfigs (App, Node, SW, Worker) aktiv.
- Rund 70 oxlint-Warnungen (Kanon: `warn`), v. a. `typescript/no-non-null-assertion`
  (27, außerhalb der Tests) und `unicorn/no-array-sort` — Altbestand, beim Anfassen
  einer Datei jeweils mitaufräumen. `bun run lint` muss mit Exit 0 enden.
- `src/lib/db/useLiveQuery.ts` ist `webBase.unmanaged` (Dexie-kompatible
  Signatur) und bleibt unangetastet; `.oxlintrc.json` schaltet dort
  `react/refs` und `react/exhaustive-deps` ab, statt die Datei zu ändern.
- `compatibility_date` in `wrangler.toml` und `nodejs_compat` sind bewusst
  **nicht** flottenweit angeglichen worden: beide ändern Workers-Runtime-Semantik
  und die App deployt bei Merge auf `main` automatisch. Einzeln bumpen, mit
  Smoke-Test.
