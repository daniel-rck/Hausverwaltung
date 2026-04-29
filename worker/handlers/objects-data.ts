import type { Env } from '../lib/types';
import { verifyBearerForId, jsonError } from '../lib/auth';
import { rateLimit, clientIp, rateLimited } from '../lib/ratelimit';

const MAX_BODY_BYTES = 60 * 1024 * 1024;

function r2Key(id: string): string {
  return `objects/${id}/data.json`;
}

function quote(etag: string): string {
  if (etag.startsWith('"') && etag.endsWith('"')) return etag;
  return `"${etag}"`;
}

function stripQuotes(etag: string): string {
  if (etag.startsWith('"') && etag.endsWith('"')) return etag.slice(1, -1);
  if (etag.startsWith('W/"') && etag.endsWith('"')) return etag.slice(3, -1);
  return etag;
}

async function checkAuth(
  request: Request,
  id: string,
): Promise<{ ok: true } | { ok: false; res: Response }> {
  if (!/^[0-9a-z]{20,40}$/.test(id)) {
    return { ok: false, res: jsonError(400, 'invalid_id') };
  }
  const secret = await verifyBearerForId(request, id);
  if (!secret) {
    return { ok: false, res: jsonError(403, 'forbidden') };
  }
  return { ok: true };
}

export async function handleObjectGet(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const ip = clientIp(request);
  const rl = await rateLimit(env, `data:${ip}`, 60, 60);
  if (!rl.allowed) return rateLimited(rl.retryAfter);

  const auth = await checkAuth(request, id);
  if (!auth.ok) return auth.res;

  const ifNoneMatch = request.headers.get('if-none-match') ?? undefined;
  const obj = await env.SYNC_BUCKET.get(r2Key(id), {
    onlyIf: ifNoneMatch ? { etagDoesNotMatch: stripQuotes(ifNoneMatch) } : undefined,
  });

  if (obj === null) {
    return new Response(null, { status: 404 });
  }

  // R2 returns metadata-only (no `body`) when `onlyIf` precondition fails →
  // means the etag matched what the client sent → 304 Not Modified.
  if (!('body' in obj) || obj.body === null) {
    return new Response(null, {
      status: 304,
      headers: { ETag: quote(obj.etag) },
    });
  }

  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ETag: quote(obj.etag),
      'Cache-Control': 'no-store',
    },
  });
}

export async function handleObjectPut(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const ip = clientIp(request);
  const rl = await rateLimit(env, `data:${ip}`, 60, 60);
  if (!rl.allowed) return rateLimited(rl.retryAfter);

  const auth = await checkAuth(request, id);
  if (!auth.ok) return auth.res;

  const lenHeader = request.headers.get('content-length');
  if (lenHeader === null) {
    // Ohne Length-Header (Chunked) können wir den 60-MB-Cap nicht
    // billig vorab prüfen — Upload ablehnen.
    return jsonError(411, 'length_required');
  }
  // HTTP-Spec: Content-Length ist eine nicht-negative Ganzzahl. `Number()`
  // akzeptiert sonst auch "1.5", "1e3", führende/trailing Whitespace etc.
  const contentLength = Number(lenHeader.trim());
  if (
    !Number.isFinite(contentLength) ||
    !Number.isInteger(contentLength) ||
    contentLength < 0
  ) {
    return jsonError(400, 'invalid_content_length');
  }
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError(413, 'body_too_large');
  }

  // Per-id soft cap as a wall against compromised secrets.
  const idRl = await rateLimit(env, `data-put:${id}`, 30, 60);
  if (!idRl.allowed) return rateLimited(idRl.retryAfter);

  const ifMatch = request.headers.get('if-match') ?? undefined;

  const body = request.body;
  if (!body) {
    return jsonError(400, 'empty_body');
  }

  const obj = await env.SYNC_BUCKET.put(r2Key(id), body, {
    httpMetadata: { contentType: 'application/json' },
    onlyIf: ifMatch ? { etagMatches: stripQuotes(ifMatch) } : undefined,
  });

  if (obj === null) {
    return jsonError(412, 'etag_mismatch');
  }

  const quoted = quote(obj.etag);
  return new Response(JSON.stringify({ etag: quoted }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ETag: quoted,
    },
  });
}
