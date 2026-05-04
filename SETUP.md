# Cloudflare Setup

Du brauchst genau **drei Cloudflare-Services** — alle im kostenlosen
Free-Tier nutzbar, keine Kreditkarte nötig.

| Service | Resource-Name (Dashboard) | Binding (im Code) | Wofür | Free Tier |
|---|---|---|---|---|
| **Workers** | `hausverwaltung` | — | Hostet die SPA + das `/api/*`-Backend | 100k Requests/Tag |
| **Static Assets** | *(automatisch)* | `ASSETS` | Liefert die SPA (HTML/JS/CSS aus `dist/`) — Cloudflare hostet die Build-Artefakte direkt am Edge, ohne dass jeder Request den Worker durchläuft | inklusive im Workers-Plan |
| **R2** | `hausverwaltung-sync` | `SYNC_BUCKET` | Verschlüsselte Sync-Datei (`objects/<id>/data.json`) | 10 GB, 1M Class-A + 10M Class-B Ops/Monat |
| **KV** | `hausverwaltung-pairing` | `PAIR_KV` | OTP-Pairing-Tickets (TTL 5 min) + Rate-Limit-Counter | 100k Reads/Tag, 1k Writes/Tag |

Die Resource-Namen sind frei wählbar (oben sind die empfohlenen Defaults
mit `hausverwaltung-`-Prefix). Die Binding-Namen im Code (`SYNC_BUCKET`,
`PAIR_KV`, `ASSETS`) sind dagegen **fest** — sie stehen in
`worker/lib/types.ts` und müssen bei der Binding-Konfiguration exakt so
geschrieben werden.

Das `ASSETS`-Binding richtet Cloudflare beim Deploy automatisch ein —
gesteuert über den `[assets]`-Block in `wrangler.toml` (Quell-Verzeichnis
`./dist`, SPA-Routing für unbekannte Pfade). Du musst es im Dashboard
nicht manuell anlegen, es taucht nach dem ersten Deploy automatisch in
der Bindings-Liste auf. R2 und KV dagegen erstellst du manuell (siehe
unten).

Bei typischer Nutzung (3–10 Wohneinheiten, 1–3 Geräte) bleibst du
problemlos im Free-Tier.

---

## Schritt-für-Schritt

### 0. Voraussetzungen

- Cloudflare-Account: <https://dash.cloudflare.com/sign-up>
- Wrangler CLI: `bun add -g wrangler` oder `npm i -g wrangler`
- Eingeloggt: `wrangler login`

### 1. R2-Bucket anlegen

```bash
wrangler r2 bucket create hausverwaltung-sync
```

Oder im Dashboard: **R2 → Create bucket** → Name `hausverwaltung-sync`.

Der Bucket-Name kann frei gewählt werden — er taucht im Code nicht auf.
Verknüpft wird er gleich über das **Binding** `SYNC_BUCKET`.

### 2. KV-Namespace anlegen

```bash
wrangler kv namespace create hausverwaltung-pairing
```

Im Output steht die Namespace-ID, z.B.:

```
🌀 Creating namespace with title "hausverwaltung-pairing"
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "PAIR_KV"
id = "abc123def456..."
```

Die ID notieren — falls du später die Bindings in `wrangler.toml`
deklarieren willst, brauchst du sie. Über das Dashboard reicht der Name.

> **Namens-Konvention:** Der Resource-Name im CF-Dashboard ist
> `hausverwaltung-pairing`. Der Binding-Variablenname im Worker-Code
> bleibt `PAIR_KV` — er ist im TypeScript fest verdrahtet (`env.PAIR_KV`).
> Beim Binding-Setup verbindest du den Variablennamen mit dem
> Resource-Namen.

### 3. Worker mit Git verbinden

Im Cloudflare-Dashboard:

1. **Workers & Pages → Create → Workers → Connect to Git**
2. Repo `daniel-rck/Hausverwaltung` auswählen
3. Build settings:
   - Build command: `bun install --frozen-lockfile && bun run build`
   - Deploy command: *(leer lassen — `wrangler deploy` ist Default)*
   - Root directory: *(leer)*
4. Branch: `main`
5. **Save & Deploy**

Cloudflare erkennt Bun automatisch über `packageManager` in `package.json`.

### 4. Bindings zuweisen ⚠️ **Der häufigste Fehler-Punkt**

Im Worker-Dashboard: **Settings → Bindings → Add binding**

**R2-Binding:**

| Feld | Wert |
|---|---|
| Type | R2 bucket |
| Variable name | `SYNC_BUCKET` *(exakt so!)* |
| R2 bucket | `hausverwaltung-sync` |

**KV-Binding:**

| Feld | Wert |
|---|---|
| Type | KV namespace |
| Variable name | `PAIR_KV` *(exakt so!)* |
| KV namespace | `hausverwaltung-pairing` |

**Beide für Production UND Preview anlegen** — sonst funktioniert Sync
nur in einer der beiden Umgebungen.

### 5. Re-Deploy

Nach Binding-Änderungen muss neu deployed werden:

- Im Dashboard auf den letzten Build → **Retry deployment**
- Oder leeren Commit auf `main` pushen: `git commit --allow-empty -m "redeploy" && git push`

### 6. Verifizieren

Auf der deployten URL: **Einstellungen → Sync → "Sync aktivieren"**.

Im Browser-Netzwerktab solltest du sehen:

1. `GET /api/objects/<id>/data` → **404** (noch keine Daten — erwartet)
2. `PUT /api/objects/<id>/data` → **200** (erster Upload)

Wenn beides klappt: ✅ fertig.

---

## Troubleshooting

### `503 binding_missing:SYNC_BUCKET` oder `binding_missing:PAIR_KV`

Die genannte Bindung ist im Dashboard nicht zugewiesen — oder der
Variable-Name ist falsch geschrieben. Schritt 4 prüfen: die Namen
müssen **exakt** `SYNC_BUCKET` und `PAIR_KV` lauten (Großbuchstaben,
Unterstrich).

### `500 internal_error:<message>`

Echter Runtime-Fehler. Die Message gibt den Hinweis:

- `R2 bucket … not found` → Bucket gelöscht oder falsch verknüpft
- `KV namespace … not found` → KV-Namespace gelöscht
- alles andere → Issue auf GitHub aufmachen mit der Message

### Bindings verschwinden nach Deploy

Bekanntes Cloudflare-Verhalten: Workers Builds (Git-Auto-Deploy)
überschreibt manchmal Dashboard-Bindings. Workaround — Bindings in
`wrangler.toml` deklarieren:

```toml
[[r2_buckets]]
binding = "SYNC_BUCKET"
bucket_name = "hausverwaltung-sync"

[[kv_namespaces]]
binding = "PAIR_KV"
id = "<id-des-hausverwaltung-pairing-namespace>"
```

Dann sind die Bindings Teil des Repos und überleben jeden Re-Deploy.
Wenn du diesen Weg gehst, kannst du die manuell zugewiesenen Bindings
im Dashboard entfernen.

### Pairing-Code wird abgelehnt

OTP-TTL ist 5 Minuten. Wenn der Code zu lange offen liegt, wird er
verworfen. Auf Gerät A neuen Code generieren.

### Sync-Status bleibt auf "Synchronisiere…"

Browser-DevTools öffnen → Console + Network. Letzten `/api/*`-Request
anschauen — Statuscode + Response-Body zeigen, was schiefläuft.
