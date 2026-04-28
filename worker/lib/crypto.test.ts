import { describe, expect, it } from 'vitest';
import { deriveSyncId, randomOtp, sha256Hex, timingSafeEqual } from './crypto';

describe('sha256Hex', () => {
  it('produces the canonical SHA-256 of a known input', async () => {
    // Known SHA-256 of "abc"
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('produces 64 lowercase hex characters', async () => {
    const h = await sha256Hex('hello world');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('deriveSyncId', () => {
  it('is deterministic for the same secret', async () => {
    const a = await deriveSyncId('my-secret');
    const b = await deriveSyncId('my-secret');
    expect(a).toBe(b);
  });

  it('produces different ids for different secrets', async () => {
    const a = await deriveSyncId('secret-one');
    const b = await deriveSyncId('secret-two');
    expect(a).not.toBe(b);
  });

  it('returns 26 characters in the Crockford-base32 alphabet', async () => {
    const id = await deriveSyncId('any-32-byte-input-secret-string');
    expect(id).toHaveLength(26);
    // Crockford base32 alphabet (lowercase): 0-9 + a-z without i, l, o, u
    expect(id).toMatch(/^[0-9abcdefghjkmnpqrstvwxyz]+$/);
  });

  it('refuses to silently collide on near-identical inputs', async () => {
    const a = await deriveSyncId('secret');
    const b = await deriveSyncId('secre1'); // one char diff
    expect(a).not.toBe(b);
  });
});

describe('timingSafeEqual', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
  });

  it('returns false when one character differs', () => {
    expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', 'a')).toBe(false);
  });

  it('returns true for two empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });
});

describe('randomOtp', () => {
  it('produces exactly 6 digits, zero-padded', () => {
    for (let i = 0; i < 50; i++) {
      const otp = randomOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });

  it('does not always return the same value (entropy sanity)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(randomOtp());
    // 100 samples in a 1M-space — collision probability is negligible
    expect(seen.size).toBeGreaterThan(95);
  });

  it('covers values that need leading-zero padding', () => {
    // Force one specific generation by sampling many times — at least one
    // should have a leading zero in 1000 samples (probability ~1 - 0.9^1000 ≈ 1)
    const samples = Array.from({ length: 2000 }, () => randomOtp());
    expect(samples.some((s) => s.startsWith('0'))).toBe(true);
  });
});
