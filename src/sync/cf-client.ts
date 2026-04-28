/**
 * Cloudflare-Pages-Functions sync client. Replaces the OneDrive/MSAL client.
 *
 * Auth model: no account binding. The browser stores a 32-byte random
 * `sync-secret` in localStorage; the server-side namespace ID is derived from
 * `sha256(secret)`. Multiple devices share the same namespace by transferring
 * the secret via short-lived OTP-pairing — see `pair-crypto.ts`.
 */

import {
  unwrapSecretFromPairing,
  wrapSecretForPairing,
  type ClaimedPayload,
} from './pair-crypto';

const LS_SECRET = 'hv-sync-secret';
const LS_ID = 'hv-sync-id';

const API_BASE = (import.meta.env.VITE_SYNC_API_URL ?? '/api').replace(/\/$/, '');
const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

export interface RemoteFile {
  content: string;
  etag: string;
}

export class EtagConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EtagConflictError';
  }
}

export function isConfigured(): boolean {
  // Always configured — no build-time secret required.
  return true;
}

export function isEnabled(): boolean {
  return Boolean(localStorage.getItem(LS_SECRET));
}

export function getSyncId(): string | null {
  return localStorage.getItem(LS_ID);
}

function getSecret(): string {
  const s = localStorage.getItem(LS_SECRET);
  if (!s) throw new Error('Sync nicht aktiv.');
  return s;
}

export async function enableAsOwner(): Promise<{ id: string }> {
  // Schutz vor versehentlichem Überschreiben eines bestehenden Secrets —
  // sonst wäre der bisherige Remote-Datenbestand unter altem Namespace
  // unwiederbringlich verwaist.
  if (localStorage.getItem(LS_SECRET)) {
    throw new Error('Sync ist bereits aktiv. Bitte zuerst zurücksetzen.');
  }
  const secret = randomBase32(32);
  const id = await deriveSyncId(secret);
  localStorage.setItem(LS_SECRET, secret);
  localStorage.setItem(LS_ID, id);
  return { id };
}

export async function enableFromPairing(secret: string): Promise<{ id: string }> {
  // Beim Pairing wird das alte Secret bewusst durch das des Owner-Geräts
  // ersetzt — der Aufrufer hat das in claimPairing schon explizit gewollt.
  const id = await deriveSyncId(secret);
  localStorage.setItem(LS_SECRET, secret);
  localStorage.setItem(LS_ID, id);
  return { id };
}

export function disable(): void {
  localStorage.removeItem(LS_SECRET);
  localStorage.removeItem(LS_ID);
}

export interface PairingTicket {
  otp: string;
  expiresAt: number;
}

export async function createPairing(): Promise<PairingTicket> {
  const secret = getSecret();

  for (let attempt = 0; attempt < 3; attempt++) {
    const otp = randomOtp();
    const wrapped = await wrapSecretForPairing(secret, otp);
    const res = await fetch(`${API_BASE}/pair/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wrapped),
    });
    if (res.status === 409) continue; // OTP collision — retry
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, 'Verknüpfung fehlgeschlagen'));
    }
    const { expiresAt } = (await res.json()) as { expiresAt: number };
    return { otp, expiresAt };
  }
  throw new Error('Konnte keinen freien Pairing-Code erzeugen.');
}

export async function claimPairing(otp: string): Promise<{ id: string }> {
  const trimmed = otp.replace(/\D+/g, '').slice(0, 6);
  if (trimmed.length !== 6) {
    throw new Error('Code muss 6 Ziffern haben.');
  }
  const res = await fetch(`${API_BASE}/pair/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otp: trimmed }),
  });
  if (res.status === 404) {
    throw new Error('Code ungültig oder abgelaufen.');
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Verknüpfung fehlgeschlagen'));
  }
  const payload = (await res.json()) as ClaimedPayload;
  let secret: string;
  try {
    secret = await unwrapSecretFromPairing(trimmed, payload);
  } catch {
    throw new Error('Code ungültig oder abgelaufen.');
  }
  return enableFromPairing(secret);
}

export async function downloadSyncFile(
  currentEtag?: string,
): Promise<RemoteFile | null | 'not-modified'> {
  const secret = getSecret();
  const id = await deriveSyncId(secret);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
  };
  if (currentEtag) headers['If-None-Match'] = currentEtag;

  const res = await fetch(`${API_BASE}/objects/${id}/data`, { headers });
  if (res.status === 404) return null;
  if (res.status === 304) return 'not-modified';
  if (res.status === 403) {
    throw new Error('Sync-Authentifizierung fehlgeschlagen.');
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Sync-Download fehlgeschlagen'));
  }
  const etag = res.headers.get('etag') ?? '';
  const content = await res.text();
  return { content, etag };
}

export async function uploadSyncFile(
  content: string,
  ifMatch?: string,
): Promise<string> {
  const secret = getSecret();
  const id = await deriveSyncId(secret);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  };
  if (ifMatch) headers['If-Match'] = ifMatch;

  const res = await fetch(`${API_BASE}/objects/${id}/data`, {
    method: 'PUT',
    headers,
    body: content,
  });
  if (res.status === 412) {
    throw new EtagConflictError('Remote wurde parallel geändert.');
  }
  if (res.status === 413) {
    throw new Error('Sync-Datei zu groß.');
  }
  if (res.status === 403) {
    throw new Error('Sync-Authentifizierung fehlgeschlagen.');
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Sync-Upload fehlgeschlagen'));
  }
  const etag = res.headers.get('etag');
  if (etag) return etag;
  const body = (await res.json()) as { etag?: string };
  return body.etag ?? '';
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ? `${fallback}: ${data.error} (${res.status})` : `${fallback}: ${res.status}`;
  } catch {
    return `${fallback}: ${res.status}`;
  }
}

function randomBase32(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return crockfordBase32(bytes);
}

function crockfordBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += CROCKFORD[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

async function deriveSyncId(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return crockfordBase32(hash.subarray(0, 16));
}

function randomOtp(): string {
  const max = 1_000_000;
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) {
      return (buf[0] % max).toString().padStart(6, '0');
    }
  }
}
