import { describe, expect, it } from 'vitest';
import { jsonError, verifyBearerForId } from './auth';
import { deriveSyncId } from './crypto';

describe('verifyBearerForId', () => {
  function makeReq(headers: Record<string, string> = {}): Request {
    return new Request('https://example.test/', { headers });
  }

  it('returns the secret when the bearer token matches the URL id', async () => {
    const secret = 'mysecret-32-byte-base32-content';
    const id = await deriveSyncId(secret);
    const req = makeReq({ authorization: `Bearer ${secret}` });
    expect(await verifyBearerForId(req, id)).toBe(secret);
  });

  it('returns null when the URL id does not match the token', async () => {
    const secret = 'tampering-target-secret';
    const wrongId = await deriveSyncId('different-secret');
    const req = makeReq({ authorization: `Bearer ${secret}` });
    expect(await verifyBearerForId(req, wrongId)).toBeNull();
  });

  it('returns null when there is no Authorization header', async () => {
    const id = await deriveSyncId('any-secret');
    const req = makeReq();
    expect(await verifyBearerForId(req, id)).toBeNull();
  });

  it('returns null for non-Bearer auth schemes', async () => {
    const secret = 'my-secret';
    const id = await deriveSyncId(secret);
    const req = makeReq({ authorization: `Basic ${secret}` });
    expect(await verifyBearerForId(req, id)).toBeNull();
  });

  it('returns null for an empty Bearer token', async () => {
    const id = await deriveSyncId('any');
    const req = makeReq({ authorization: 'Bearer ' });
    expect(await verifyBearerForId(req, id)).toBeNull();
  });

  it('rejects when the token is one character off (constant-time check)', async () => {
    const secret = 'my-32-char-secret-base32-string';
    const id = await deriveSyncId(secret);
    // Send a slightly different secret — derived id won't match
    const req = makeReq({ authorization: `Bearer ${secret}x` });
    expect(await verifyBearerForId(req, id)).toBeNull();
  });
});

describe('jsonError', () => {
  it('returns a JSON response with the given status and message', async () => {
    const res = jsonError(403, 'forbidden');
    expect(res.status).toBe(403);
    expect(res.headers.get('content-type')).toBe('application/json');
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('forbidden');
  });
});
