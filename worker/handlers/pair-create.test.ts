import { reset, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';

const VALID_BODY = {
  otp: '123456',
  wrappedSecret: btoa('a'.repeat(48)),
  iv: btoa('b'.repeat(12)),
  salt: btoa('c'.repeat(16)),
  nonce: btoa('d'.repeat(8)),
};

afterEach(() => reset());

function postCreate(body: object): Promise<Response> {
  return SELF.fetch('https://test.local/api/pair/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/pair/create', () => {
  it('returns 200 with a future expiresAt for a valid payload', async () => {
    const before = Date.now();
    const res = await postCreate(VALID_BODY);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { expiresAt: number };
    // TTL is 300 s — expiresAt should be ~5 min in the future, with some slack
    expect(body.expiresAt).toBeGreaterThan(before + 290_000);
    expect(body.expiresAt).toBeLessThan(before + 310_000);
  });

  it('rejects 409 when the same OTP is reused while the slot is still alive', async () => {
    const first = await postCreate(VALID_BODY);
    expect(first.status).toBe(200);
    const second = await postCreate(VALID_BODY);
    expect(second.status).toBe(409);
    const body = (await second.json()) as { error: string };
    expect(body.error).toBe('otp_collision');
  });

  it('rejects 400 for a non-6-digit OTP', async () => {
    const res = await postCreate({ ...VALID_BODY, otp: '12345' });
    expect(res.status).toBe(400);
  });

  it('rejects 400 when wrappedSecret is missing', async () => {
    const { wrappedSecret: _omit, ...rest } = VALID_BODY;
    void _omit;
    const res = await postCreate(rest);
    expect(res.status).toBe(400);
  });

  it('rejects 400 for an oversized ciphertext', async () => {
    const oversized = { ...VALID_BODY, wrappedSecret: 'A'.repeat(300) };
    const res = await postCreate(oversized);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('payload_too_large');
  });

  it('rejects 400 for invalid JSON body', async () => {
    const res = await SELF.fetch('https://test.local/api/pair/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('rejects 405 for non-POST methods', async () => {
    const res = await SELF.fetch('https://test.local/api/pair/create', {
      method: 'GET',
    });
    expect(res.status).toBe(405);
  });

  it('rate-limits after 5 requests in the same minute', async () => {
    // Vary the OTP each call so 409 doesn't mask the rate limit
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const otp = String(100000 + i);
      const res = await postCreate({ ...VALID_BODY, otp });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
