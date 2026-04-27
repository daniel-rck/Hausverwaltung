/**
 * Pairing crypto: client-side wrap/unwrap of the sync-secret using HKDF-SHA256
 * over the OTP, then AES-GCM with a random IV. The Worker only relays the
 * ciphertext; the OTP never leaves the device A → user → device B channel.
 *
 * Justification: OTP entropy alone (~20 bits) is too weak against offline
 * brute-force; mitigations are KV-TTL 300s, one-shot delete on claim, and
 * server-side rate-limiting on /pair/claim. The encryption ensures the
 * Worker operator cannot recover the secret from KV dumps or logs.
 */

const HKDF_INFO = new TextEncoder().encode('hv-pair-v1');

export interface WrappedPayload {
  otp: string;
  wrappedSecret: string; // base64
  iv: string;            // base64
  salt: string;          // base64
  nonce: string;         // base64
}

export interface ClaimedPayload {
  wrappedSecret: string;
  iv: string;
  salt: string;
  nonce: string;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(arr);
  return arr;
}

function utf8Bytes(s: string): Uint8Array<ArrayBuffer> {
  const src = new TextEncoder().encode(s);
  const out = new Uint8Array(new ArrayBuffer(src.byteLength));
  out.set(src);
  return out;
}

async function deriveKey(
  otp: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey(
    'raw',
    utf8Bytes(otp),
    'HKDF',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: HKDF_INFO },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function wrapSecretForPairing(
  secret: string,
  otp: string,
): Promise<WrappedPayload> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const nonce = randomBytes(8);
  const key = await deriveKey(otp, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: nonce },
    key,
    utf8Bytes(secret),
  );
  return {
    otp,
    wrappedSecret: base64Encode(new Uint8Array(ciphertext)),
    iv: base64Encode(iv),
    salt: base64Encode(salt),
    nonce: base64Encode(nonce),
  };
}

export async function unwrapSecretFromPairing(
  otp: string,
  payload: ClaimedPayload,
): Promise<string> {
  const salt = base64Decode(payload.salt);
  const iv = base64Decode(payload.iv);
  const nonce = base64Decode(payload.nonce);
  const ciphertext = base64Decode(payload.wrappedSecret);
  const key = await deriveKey(otp, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: nonce },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

function base64Encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64Decode(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
