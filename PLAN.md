# Deep Fixup — Hausverwaltung (2026-06-09)

## Context

Deep-fixup session: analyze → plan → execute. Three parallel audits (db/sync layer, Cloudflare Worker, features/UI/docs) plus firsthand verification of every candidate finding. The repo is in good shape: baseline fully green, no TODO debt, crypto and ETag protocol sound, calculations guarded, docs largely accurate. The verified findings are one real cross-device sync bug, two small robustness/test gaps, and housekeeping/docs drift.

**Branch**: work happens on `claude/deep-fixup-liebdj` (session-mandated; supersedes the skill's `fixup/<date>` convention). Working tree was clean at start.

**Baseline (recorded, all green)**
- `bun run lint` → exit 0 (194 style warnings — deliberate `warn` config, tied to documented Phase-4 gap; not a task)
- `bun run typecheck` → exit 0
- `bun run test:run` → 10 files, 117 tests passed
- `bun run build` → SPA + PWA build OK

Full verification command for the session:
`bun run lint && bun run typecheck && bun run test:run && bun run build`

## Findings dismissed after verification (no tasks)

- **"JSON.parse corruption breaks state machine" (service.ts:273)** — false: the exception aborts `syncOnce` before any local mutation; caught upstream, status → error, dirty restored. Only the error *message* is cryptic → folded into T2.
- **"Missing CORS preflight = critical"** — false alarm: worker serves SPA + `/api/*` same-origin by design; `VITE_SYNC_API_URL` (cross-origin) is an undocumented escape hatch, unsupported config.
- **pair-claim get→delete race** — real but a Cloudflare-KV platform limitation (no atomic ops); impact negligible since any claimer must already know the OTP (the actual key material for unwrapping). Documented via comment in T3.
- **cascade.ts partial cascades** — explicitly documented tradeoff (header comment + CLAUDE.md).
- **Orphaned maintenance documents** — impossible in practice: `DocumentStore` is only ever mounted with `entityType="unit"`, and unit docs are cascade-deleted.
- **Body-size limits on pair endpoints** — rate limiting runs *before* body parse on both handlers; abuse is bounded. Skip.
- **merge.ts `updatedAt ?? 0`** — not demonstrable: `table.ts` stamps every write path.
- **`key={index}` in RoomInspection/KeyHandover, zinc-* styles, `noUncheckedIndexedAccess`** — documented deliberate state / Phase-4.

## Tasks (execution order)

- [ ] T1: Write PLAN.md (this plan) into repo root
      Files: PLAN.md (new)
      Change: Copy this plan as the session record; tasks get checked off there as the single source of progress.
      Verify: file exists; committed.

- [ ] T2: Sync-Bug: eingebettete meterIds in handoverProtocols übersetzen + Snapshot-Validierung
      Files: src/lib/sync/snapshot.ts, src/lib/sync/service.ts, src/lib/sync/snapshot.test.ts (new)
      Change (bug): `HandoverProtocol.meterReadings: {meterId, value}[]` embeds **local numeric meter IDs**; `translateRowToWire`/`translateRowFromWire` only translate top-level FK fields (FK_MAP) → after sync, device B's protocols point at wrong/nonexistent meters (ProtocolPreview at UebergabePage.tsx:391-402 silently drops them or shows a wrong meter).
        - In `translateRowToWire`: special-case `tableName === "handoverProtocols"` — map each reading to `{ meterId__sync, value }` via `idToSyncId.meters`; drop readings whose meter has no syncId mapping (matches existing "skip dangling" render behavior).
        - In `translateRowFromWire`: map `{ meterId__sync, value }` back via `syncIdToLocalId`; drop unresolvable entries; pass through legacy wire entries that still carry a raw `meterId` unchanged. Order is safe: `meters` precede `handoverProtocols` in `topologicalOrder()`.
      Change (validation): in `service.ts syncOnce` (or a small `parseSnapshot` helper in snapshot.ts), validate the parsed remote snapshot (`version === 1`, `tables` is an object, `tombstones` is an array) and throw a clear German error instead of letting malformed content surface as "x is not iterable".
      Test: new `snapshot.test.ts` (pattern of idb.test.ts: `fake-indexeddb/auto`, wipe via `db.tables`): seed meter + handover protocol → `buildLocalSnapshot()` → assert wire has `meterId__sync` and no raw `meterId`/`id` → wipe tables → `applySnapshot()` → assert reading's `meterId` equals the *new* local meter id (auto-increment keeps counting after clear, so IDs differ — meaningful assertion). Plus a parseSnapshot rejection test.
      Verify: `bun run test:run && bun run typecheck`

- [ ] T3: Worker: Rate-Limit-Test für /pair/claim + Kommentar zur KV-Race
      Files: worker/handlers/pair-claim.test.ts, worker/handlers/pair-claim.ts
      Change: add a test mirroring pair-create's rate-limit test: 10 claims pass (404/200 allowed), 11th returns 429 (limit 10 per 900 s, keyed per IP). Add a short comment in pair-claim.ts documenting that get→delete is not atomic on KV (concurrent claims can both succeed) and why that's acceptable (payload is OTP-encrypted; claimer must know the OTP anyway).
      Verify: `bun run test:run`

- [ ] T4: Micro-Fix: negative Monatsdifferenz in getPersonMonths abfangen
      Files: src/lib/db/queries.ts:70 (getPersonMonths)
      Change: `const months = Math.max(0, monthDiff(start, end) + 1);` — guards corrupt occupancies (`from > to`) from producing negative person-months in the Nebenkosten allocation.
      Verify: `bun run test:run`

- [ ] T5: Build-Artefakt aus Git entfernen
      Files: tsconfig.sw.tsbuildinfo (tracked!), .gitignore
      Change: `git rm --cached tsconfig.sw.tsbuildinfo`; add `*.tsbuildinfo` to .gitignore (under a build/cache section).
      Verify: `git ls-files | grep tsbuildinfo` → empty; `bun run build` still green.

- [ ] T6: Docs-Drift: CONTRIBUTING.md Architektur-Spickzettel aktualisieren
      Files: CONTRIBUTING.md:78-89
      Change: the tree still shows the pre-migration layout (`src/modules/`, `src/components/`, `src/db/` "Dexie-Schema", `src/hooks/`...). Update to reality: `src/lib/{db,sync,ui,hooks,utils}` + `src/features/<modul>` (11 Module), idb statt Dexie. Keep it the same compact style.
      Verify: proofread; `bun run lint` (formatting).

## Finish
- Run full verification: `bun run lint && bun run typecheck && bun run test:run && bun run build`
- Check all tasks off in PLAN.md, commit each task atomically (`T<nr>: <title>`), push to `claude/deep-fixup-liebdj`, open draft PR.

## Not this session
- `noUncheckedIndexedAccess` + the 194 lint warnings (documented Phase-4 type/storage work).
- zinc-* → semantic-token migration in feature components (documented gradual).
- "Gemeinschaft" maintenance items (`unitId === null`) have no `propertyId` and appear under **all** properties (MaintenanceList.tsx:90); needs a schema migration — Phase-4 candidate.
- Stable IDs for RoomInspection/KeyHandover rows (`key={index}`, documented).
- CORS headers if cross-origin `VITE_SYNC_API_URL` ever becomes a supported deployment; document the variable then.
- Tests for service.ts state machine and cascade.ts.
