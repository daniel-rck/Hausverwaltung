# Security Policy

## Unterstützte Versionen

Es gibt aktuell ein Rolling-Release-Modell — nur der `main`-Branch erhält
Sicherheits-Fixes. Bitte vor einem Report mit der neuesten Version testen.

| Version | Status |
|---|---|
| `main` (latest) | ✅ unterstützt |
| Frühere Commits | ❌ nur via Update |

## Sicherheitslücke melden

**Bitte nicht** als öffentliches Issue. Stattdessen einen der folgenden Wege:

1. **GitHub Security Advisory (bevorzugt)**:
   [Neues Advisory erstellen](https://github.com/daniel-rck/Hausverwaltung/security/advisories/new)
   — privat, koordinierte Offenlegung.
2. Falls Advisories nicht möglich: E-Mail an den Maintainer unter
   [daniel-rck@proton.me](mailto:daniel-rck@proton.me).

Bitte gib so viel Detail wie möglich an:

- Betroffene Komponente (SPA, Worker, Sync-Protokoll)
- Schritte zur Reproduktion / Proof-of-Concept
- Auswirkung (Daten-Lesung, -Manipulation, DoS, …)
- Vorgeschlagener Fix (falls vorhanden)

## Reaktionszeit

- **Bestätigung des Eingangs**: innerhalb von 7 Tagen
- **Erste Einschätzung**: innerhalb von 14 Tagen
- **Fix-Timeline**: abhängig vom Schweregrad, in der Regel 2–4 Wochen nach
  Bestätigung. Kritische Lücken werden priorisiert.

Nach Veröffentlichung des Fixes wird die Lücke im
[CHANGELOG](./CHANGELOG.md) und im jeweiligen Security Advisory dokumentiert.

## Scope

**In-Scope:**

- Sync-Backend (`worker/`): Verschlüsselung, OTP-Pairing, Rate-Limiting,
  Authentifizierung von `/api/*`-Endpoints
- Client-seitige Daten-Integrität (Dexie-Schema, Cascade-Deletes, Import/Export)
- Crypto-Pfade in `src/sync/` (HKDF, AES-GCM, Key-Ableitung)
- XSS / Injection in der SPA (`src/`)
- Information Disclosure über R2-Bucket-Schlüssel oder KV-Keys

**Out-of-Scope:**

- Lokale Angriffe auf das Endgerät (z.B. Zugriff auf IndexedDB ohne
  System-Disk-Encryption) — Local-First impliziert Vertrauen ins Gerät.
- Self-XSS (User fügt eigenes Skript in eigene Felder ein).
- Fehlende Security-Header im lokalen Vite-Dev-Server.
- DoS gegen das Free-Tier-Backend durch übermäßige Anfragen — wird über
  Cloudflare-Rate-Limits abgefedert.
- Probleme in Drittanbieter-Dependencies, bei denen kein verfügbarer Fix
  existiert.

## Sicherheits-Design (Kurzfassung)

- **Sync-Geheimnis** wird **clientseitig** generiert (Crypto-strong Random)
  und nie im Klartext ans Backend gesendet.
- **Object-ID** im R2-Bucket = `sha256(secret).slice(0,16)` (Crockford-Base32)
  — keine User-Tabelle im Worker, keine Account-Daten.
- **Pairing-OTP**: 6-stelliger Code, 5 min TTL in Cloudflare KV. Während der
  Übertragung wird das Sync-Geheimnis mit einem aus dem OTP abgeleiteten Key
  (HKDF-SHA256) AES-GCM-verschlüsselt — der Worker relayed nur Chiffretext.
- **Konflikt-Schutz**: R2-`ETag` mit `If-Match` (Upload) und `If-None-Match`
  (Download) — paralleler Edit liefert 412 und wird client-seitig gemerged.
- **Rate-Limits**: KV-basierte Token-Buckets pro IP (5 `pair/create`/min,
  10 `pair/claim`/15 min, 60 Data-Ops/min).

Details siehe [README.md](./README.md) und [SETUP.md](./SETUP.md).

## Anerkennung

Wer eine Lücke verantwortungsvoll meldet, wird (auf Wunsch) im Advisory
und im Changelog namentlich erwähnt.
