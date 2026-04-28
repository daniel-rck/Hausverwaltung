import { describe, expect, it } from 'vitest';
import {
  wrapSecretForPairing,
  unwrapSecretFromPairing,
} from './pair-crypto';

describe('pair-crypto', () => {
  it('roundtrips: unwrap with same OTP returns the original secret', async () => {
    const secret = '0123456789abcdefghjkmnpqrstvwxyz0123456789abcdef';
    const otp = '482913';
    const wrapped = await wrapSecretForPairing(secret, otp);
    const unwrapped = await unwrapSecretFromPairing(otp, wrapped);
    expect(unwrapped).toBe(secret);
  });

  it('rejects unwrap with the wrong OTP (AEAD failure)', async () => {
    const secret = 'some-32-byte-base32-secret-string';
    const wrapped = await wrapSecretForPairing(secret, '111111');
    await expect(
      unwrapSecretFromPairing('222222', wrapped),
    ).rejects.toThrow();
  });

  it('rejects unwrap when the ciphertext was tampered with', async () => {
    const secret = 'tamper-test-secret';
    const otp = '654321';
    const wrapped = await wrapSecretForPairing(secret, otp);
    // flip one bit in the ciphertext
    const decoded = atob(wrapped.wrappedSecret);
    const flipped =
      decoded.slice(0, 0) +
      String.fromCharCode(decoded.charCodeAt(0) ^ 0x01) +
      decoded.slice(1);
    const tampered = { ...wrapped, wrappedSecret: btoa(flipped) };
    await expect(
      unwrapSecretFromPairing(otp, tampered),
    ).rejects.toThrow();
  });

  it('rejects unwrap when the AAD nonce was changed', async () => {
    const secret = 'aad-test-secret';
    const otp = '987654';
    const wrapped = await wrapSecretForPairing(secret, otp);
    // corrupt the nonce → AEAD verification must fail
    const corruptedNonce = btoa('xxxxxxxx');
    await expect(
      unwrapSecretFromPairing(otp, { ...wrapped, nonce: corruptedNonce }),
    ).rejects.toThrow();
  });

  it('produces different ciphertext for the same secret on repeated calls', async () => {
    const secret = 'iv-uniqueness-secret';
    const a = await wrapSecretForPairing(secret, '000000');
    const b = await wrapSecretForPairing(secret, '000000');
    // IV is random per call, so wrappedSecret + iv must differ
    expect(a.wrappedSecret).not.toBe(b.wrappedSecret);
    expect(a.iv).not.toBe(b.iv);
  });
});
