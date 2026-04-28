import { reset, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';

const SLOT = {
  otp: '987654',
  wrappedSecret: btoa('w'.repeat(48)),
  iv: btoa('i'.repeat(12)),
  salt: btoa('s'.repeat(16)),
  nonce: btoa('n'.repeat(8)),
};

afterEach(() => reset());

async function createSlot(otp = SLOT.otp): Promise<void> {
  const res = await SELF.fetch('https://test.local/api/pair/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...SLOT, otp }),
  });
  if (res.status !== 200) {
    throw new Error(`Setup createSlot failed: ${res.status}`);
  }
}

function postClaim(otp: string): Promise<Response> {
  return SELF.fetch('https://test.local/api/pair/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otp }),
  });
}

describe('POST /api/pair/claim', () => {
  it('returns the wrapped payload for a valid OTP', async () => {
    await createSlot();
    const res = await postClaim(SLOT.otp);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      wrappedSecret: string;
      iv: string;
      salt: string;
      nonce: string;
    };
    expect(body.wrappedSecret).toBe(SLOT.wrappedSecret);
    expect(body.iv).toBe(SLOT.iv);
    expect(body.salt).toBe(SLOT.salt);
    expect(body.nonce).toBe(SLOT.nonce);
  });

  it('deletes the slot after first claim — second claim returns 404', async () => {
    await createSlot();
    const first = await postClaim(SLOT.otp);
    expect(first.status).toBe(200);
    const second = await postClaim(SLOT.otp);
    expect(second.status).toBe(404);
    const body = (await second.json()) as { error: string };
    expect(body.error).toBe('expired_or_unknown');
  });

  it('returns 404 for an unknown OTP', async () => {
    const res = await postClaim('000000');
    expect(res.status).toBe(404);
  });

  it('returns 400 for a non-6-digit OTP', async () => {
    const res = await postClaim('12345');
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await SELF.fetch('https://test.local/api/pair/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('returns 405 for non-POST methods', async () => {
    const res = await SELF.fetch('https://test.local/api/pair/claim', {
      method: 'GET',
    });
    expect(res.status).toBe(405);
  });
});
