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
`worker/lib/types.ts` und müssen exakt so geschrieben werden.

Bindings sind in [`wrangler.toml`](./wrangler.toml) hinterlegt — sie
gehören also zum Repo und überleben jeden Re-Deploy. Du musst sie nicht
mehr manuell im Dashboard zuweisen; nur einmalig die KV-Namespace-ID
einfügen (Schritt 3 unten).

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

**Diese ID brauchst du im nächsten Schritt** — kopier sie.

### 3. KV-ID in `wrangler.toml` eintragen

> Nur relevant beim **Forken**: für das Original-Repo ist die ID schon
> hinterlegt. Wenn du die App selbst deployst, zeigt der `id`-Wert noch
> auf einen anderen Account und der Deploy schlägt mit
> `KV namespace … is not valid` fehl — du musst ihn durch deine eigene
> Namespace-ID ersetzen.

In [`wrangler.toml`](./wrangler.toml):

```toml
[[kv_namespaces]]
binding = "PAIR_KV"
id = "<32-Hex-Zeichen — deine eigene Namespace-ID>"
```

ID holen — entweder per CLI:
```bash
wrangler kv namespace list
```
und den Eintrag mit `"title": "hausverwaltung-pairing"` raussuchen,
oder im Dashboard unter **Workers & Pages → KV → hausverwaltung-pairing**.

Commit und push — beim nächsten Deploy nimmt Cloudflare die Bindings
direkt aus der `wrangler.toml`.

### 4. Worker mit Git verbinden (einmalig)

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
R2- und KV-Bindings werden beim Deploy aus `wrangler.toml` übernommen
und tauchen automatisch unter **Settings → Bindings** auf.

### 5. Verifizieren

Auf der deployten URL: **Einstellungen → Sync → „Sync aktivieren"**.

Im Browser-Netzwerktab solltest du sehen:

1. `GET /api/objects/<id>/data` → **404** (noch keine Daten — erwartet)
2. `PUT /api/objects/<id>/data` → **200** (erster Upload)

Wenn beides klappt: ✅ fertig.

---

## Troubleshooting

### `503 binding_missing:SYNC_BUCKET` oder `binding_missing:PAIR_KV`

Die genannte Bindung kommt nicht im Worker an. Häufigste Ursachen:

- KV-ID in `wrangler.toml` wurde nicht ersetzt (steht noch
  `REPLACE_WITH_…` drin).
- R2-Bucket / KV-Namespace existiert nicht (mehr) im Account, oder
  unter einem anderen Namen.
- Der Deploy lief noch nicht durch — Build-Status im Dashboard
  prüfen.

### `500 internal_error:<message>`

Echter Runtime-Fehler. Die Message gibt den Hinweis:

- `R2 bucket … not found` → Bucket-Name in `wrangler.toml` weicht vom
  tatsächlich angelegten Namen ab.
- `KV namespace … not found` → ID in `wrangler.toml` zeigt auf einen
  Namespace, der gelöscht oder umbenannt wurde.
- alles andere → Issue auf GitHub aufmachen mit der Message.

### Pairing-Code wird abgelehnt

OTP-TTL ist 5 Minuten. Wenn der Code zu lange offen liegt, wird er
verworfen. Auf Gerät A neuen Code generieren.

### Sync-Status bleibt auf „Synchronisiere…"

Browser-DevTools öffnen → Console + Network. Letzten `/api/*`-Request
anschauen — Statuscode + Response-Body zeigen, was schiefläuft.
