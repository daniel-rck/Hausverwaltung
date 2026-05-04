# Cloudflare Setup

Du brauchst genau **drei Cloudflare-Services** — alle im kostenlosen
Free-Tier nutzbar, keine Kreditkarte nötig.

| Service | Wofür | Free Tier |
|---|---|---|
| **Workers** | Hostet die SPA + das `/api/*`-Backend | 100k Requests/Tag |
| **R2** | Verschlüsselte Sync-Datei pro Geräte­gruppe (`objects/<id>/data.json`) | 10 GB Speicher, 1M Class-A + 10M Class-B Ops/Monat |
| **KV** | OTP-Pairing-Tickets (TTL 5 min) + Rate-Limit-Counter | 100k Reads/Tag, 1k Writes/Tag |

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
wrangler kv namespace create PAIR_KV
```

Im Output steht die Namespace-ID, z.B.:

```
🌀 Creating namespace with title "PAIR_KV"
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "PAIR_KV"
id = "abc123def456..."
```

Die ID notieren — falls du später die Bindings in `wrangler.toml`
deklarieren willst, brauchst du sie. Über das Dashboard reicht der Name.

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
| KV namespace | `PAIR_KV` |

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
id = "<deine-kv-namespace-id>"
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
