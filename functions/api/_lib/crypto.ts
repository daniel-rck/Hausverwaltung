/**
 * SHA-256 of a UTF-8 string, hex-lowercased.
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

/**
 * Crockford base32 of the first 16 bytes of SHA-256(input) — 26 lowercase
 * URL-safe characters. Used as the namespace ID in `objects/<id>/data.json`.
 */
export async function deriveSyncId(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return crockfordBase32(hash.subarray(0, 16));
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

/**
 * Constant-time string compare. Both strings must have the same length;
 * caller guarantees that for the id-vs-id case (always 26 chars).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * 6-digit numeric OTP, zero-padded. Uses crypto.getRandomValues (uniform
 * over 0..999999) by rejection sampling.
 */
export function randomOtp(): string {
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
