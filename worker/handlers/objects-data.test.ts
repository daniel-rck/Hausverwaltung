import { reset, SELF } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { deriveSyncId } from '../lib/crypto';

const SECRET = 'test-secret-32-byte-base32-string';
let ID = '';

beforeAll(async () => {
  ID = await deriveSyncId(SECRET);
});

afterEach(() => reset());

function url(id = ID): string {
  return `https://test.local/api/objects/${id}/data`;
}

function authHeaders(secret = SECRET): Record<string, string> {
  return { Authorization: `Bearer ${secret}` };
}

describe('GET /api/objects/:id/data', () => {
  it('returns 404 when no object has been written yet', async () => {
    const res = await SELF.fetch(url(), { headers: authHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns 200 with the object body and an ETag after PUT', async () => {
    const putRes = await SELF.fetch(url(), {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    });
    expect(putRes.status).toBe(200);

    const getRes = await SELF.fetch(url(), { headers: authHeaders() });
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('etag')).toBeTruthy();
    const body = await getRes.json();
    expect(body).toEqual({ hello: 'world' });
  });

  it('returns 304 when If-None-Match matches the current ETag', async () => {
    await SELF.fetch(url(), {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });
    const first = await SELF.fetch(url(), { headers: authHeaders() });
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const second = await SELF.fetch(url(), {
      headers: { ...authHeaders(), 'If-None-Match': etag! },
    });
    expect(second.status).toBe(304);
  });

  it('returns 200 (full body) when If-None-Match is stale', async () => {
    await SELF.fetch(url(), {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });
    const res = await SELF.fetch(url(), {
      headers: { ...authHeaders(), 'If-None-Match': '"stale-etag"' },
    });
    expect(res.status).toBe(200);
  });

  it('returns 403 when bearer token does not derive to the URL id', async () => {
    const res = await SELF.fetch(url(), {
      headers: { Authorization: 'Bearer some-other-secret' },
    });
    expect(res.status).toBe(403);
  });

  it('returns 403 when no Authorization header is set', async () => {
    const res = await SELF.fetch(url());
    expect(res.status).toBe(403);
  });

  it('returns 400 when the URL id is malformed', async () => {
    const res = await SELF.fetch('https://test.local/api/objects/!!!/data', {
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/objects/:id/data', () => {
  it('first PUT (no If-Match) succeeds and returns an ETag', async () => {
    const res = await SELF.fetch(url(), {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ first: true }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBeTruthy();
    const body = (await res.json()) as { etag: string };
    expect(body.etag).toBeTruthy();
  });

  it('PUT with stale If-Match returns 412', async () => {
    await SELF.fetch(url(), {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });
    const conflict = await SELF.fetch(url(), {
      method: 'PUT',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
        'If-Match': '"stale-etag"',
      },
      body: JSON.stringify({ a: 2 }),
    });
    expect(conflict.status).toBe(412);
  });

  it('PUT with correct If-Match (round-trip) succeeds and returns a new ETag', async () => {
    const initial = await SELF.fetch(url(), {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ v: 1 }),
    });
    const etag = initial.headers.get('etag')!;

    const second = await SELF.fetch(url(), {
      method: 'PUT',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
        'If-Match': etag,
      },
      body: JSON.stringify({ v: 2 }),
    });
    expect(second.status).toBe(200);
    const newEtag = second.headers.get('etag');
    expect(newEtag).toBeTruthy();
    expect(newEtag).not.toBe(etag);
  });

  it('PUT with wrong bearer returns 403 (no R2 write happens)', async () => {
    const res = await SELF.fetch(url(), {
      method: 'PUT',
      headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 1 }),
    });
    expect(res.status).toBe(403);

    // GET with valid auth should still 404 — write was rejected
    const get = await SELF.fetch(url(), { headers: authHeaders() });
    expect(get.status).toBe(404);
  });

  it('PUT with Content-Length over 60 MB returns 413', async () => {
    const res = await SELF.fetch(url(), {
      method: 'PUT',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
        'Content-Length': String(61 * 1024 * 1024),
      },
      body: JSON.stringify({ a: 1 }),
    });
    expect(res.status).toBe(413);
  });

  it('PUT with non-numeric Content-Length returns 400', async () => {
    const res = await SELF.fetch(url(), {
      method: 'PUT',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
        'Content-Length': 'not-a-number',
      },
      body: JSON.stringify({ a: 1 }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT with fractional Content-Length returns 400', async () => {
    const res = await SELF.fetch(url(), {
      method: 'PUT',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
        'Content-Length': '1.5',
      },
      body: JSON.stringify({ a: 1 }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT without Content-Length (chunked stream) returns 411', async () => {
    // ReadableStream body → fetch verwendet Transfer-Encoding: chunked und
    // setzt kein Content-Length. Damit testen wir den Bypass-Schutz.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"a":1}'));
        controller.close();
      },
    });
    const res = await SELF.fetch(url(), {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: stream,
      // @ts-expect-error duplex ist im fetch-Standard für Streams Pflicht,
      // wird vom Lib-Typ aber noch nicht erfasst.
      duplex: 'half',
    });
    expect(res.status).toBe(411);
  });

  it('returns 405 for non-GET/PUT methods on the data path', async () => {
    const res = await SELF.fetch(url(), {
      method: 'DELETE',
      headers: authHeaders(),
    });
    expect(res.status).toBe(405);
  });
});

describe('routing edge cases', () => {
  it('returns 404 for unknown /api/* paths', async () => {
    const res = await SELF.fetch('https://test.local/api/does/not/exist');
    expect(res.status).toBe(404);
  });
});
