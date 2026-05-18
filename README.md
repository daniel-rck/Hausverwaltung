# Hausverwaltung

[![CI](https://github.com/daniel-rck/Hausverwaltung/actions/workflows/ci.yml/badge.svg)](https://github.com/daniel-rck/Hausverwaltung/actions/workflows/ci.yml)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/Live-Demo-22c55e)](https://hausverwaltung.daniel-rck.workers.dev/)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1.3-000?logo=bun&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8)

> Kostenlose Open-Source Web-App für private Vermieter kleiner Mehrfamilienhäuser
> (3–10 Wohneinheiten). Komplett im Browser — keine Installation, kein Account,
> keine laufenden Kosten.

**[→ App starten](https://hausverwaltung.daniel-rck.workers.dev/)** ·
**[→ Issues](https://github.com/daniel-rck/Hausverwaltung/issues)**

## Highlights

- **12 Module**: Mieter, Nebenkosten, Versorger, Zähler, Mieteinnahmen, Steuer-Export (Anlage V), Mietverträge, Übergabeprotokolle, Rendite, Kaution, Mietspiegel, Instandhaltung
- **Local-First**: Daten bleiben im Browser (IndexedDB) — kein Account, keine E-Mail, keine Cloud-Pflicht
- **Optionaler Multi-Device-Sync**: Ende-zu-Ende verschlüsselt (HKDF-SHA256 → AES-GCM), Server kennt das Geheimnis nie
- **PWA**: offline-fähig, installierbar auf Mobile, Dark Mode
- **Druckbar**: A4-Abrechnungen, Mietverträge, Mahnungen, Übergabeprotokolle direkt aus dem Browser

## Quick Start (Entwickler)

```bash
git clone https://github.com/daniel-rck/Hausverwaltung.git
cd Hausverwaltung
bun install
bun dev                  # SPA auf http://localhost:5173
```

Für lokales Sync-Backend (Worker + R2 + KV via Miniflare):

```bash
bun dev:cf               # Worker + SPA gemeinsam
```

## Stack

React 19 · TypeScript 6 · Vite 8 · Tailwind 4 · Dexie (IndexedDB) ·
Cloudflare Workers + R2 + KV · Bun 1.3 · Vitest

## Scripts

| Script | Zweck |
|---|---|
| `bun dev` | Dev-Server (Vite) auf :5173 |
| `bun dev:cf` | Worker + SPA via Wrangler |
| `bun run build` | Production-Build (`dist/`) |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript-Check (App + Worker) |
| `bun run test` | Vitest (watch) |
| `bun run test:run` | Vitest (single run, CI) |
| `bun run deploy:cf` | Manuelles Deploy via Wrangler |

## Architektur

SPA (`src/`) — 11 Module unter `src/modules/`, Dexie-Schema in `src/db/`,
Sync-Client in `src/sync/`. Cloudflare Worker (`worker/`) routet `/api/*`
an die Sync-Handler und liefert sonst die statischen Assets. Sync ist
clientseitig verschlüsselt; konflikt-resolved via R2-ETag (`If-Match`).

Deploy-Setup & Free-Tier-Bindings: **[SETUP.md](./SETUP.md)**

## Mitmachen

Bug-Reports und PRs willkommen — siehe **[CONTRIBUTING.md](./CONTRIBUTING.md)** für
Dev-Setup, Code-Style und PR-Prozess. Sicherheitslücken bitte **nicht** als
öffentliches Issue: **[SECURITY.md](./SECURITY.md)**. Versionsverlauf:
**[CHANGELOG.md](./CHANGELOG.md)**.

## Lizenz

MIT — siehe [LICENSE](./LICENSE).
