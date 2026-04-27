import type { Env } from '../../_lib/types';
import { verifyBearerForId, jsonError } from '../../_lib/auth';
import { rateLimit, clientIp } from '../../_lib/ratelimit';

const MAX_BODY_BYTES = 60 * 1024 * 1024;

function r2Key(id: string): string {
  return `objects/${id}/data.json`;
}

async function checkAuth(
  ctx: EventContext<Env, 'id', unknown>,
): Promise<{ ok: true; id: string } | { ok: false; res: Response }> {
  const id = ctx.params.id;
  if (typeof id !== 'string' || !/^[0-9a-z]{20,40}$/.test(id)) {
    return { ok: false, res: jsonError(400, 'invalid_id') };
  }
  const secret = await verifyBearerForId(ctx.request, id);
  if (!secret) {
    return { ok: false, res: jsonError(403, 'forbidden') };
  }
  return { ok: true, id };
}

export const onRequestGet: PagesFunction<Env, 'id'> = async (ctx) => {
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `data:${ip}`, 60, 60);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rl.retryAfter),
      },
    });
  }

  const auth = await checkAuth(ctx);
  if (!auth.ok) return auth.res;

  const ifNoneMatch = ctx.request.headers.get('if-none-match') ?? undefined;
  const obj = await ctx.env.SYNC_BUCKET.get(r2Key(auth.id), {
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
};

export const onRequestPut: PagesFunction<Env, 'id'> = async (ctx) => {
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `data:${ip}`, 60, 60);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rl.retryAfter),
      },
    });
  }

  const auth = await checkAuth(ctx);
  if (!auth.ok) return auth.res;

  const contentLength = Number(ctx.request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError(413, 'body_too_large');
  }

  // Per-id soft cap as a wall against compromised secrets.
  const idRl = await rateLimit(ctx.env, `data-put:${auth.id}`, 30, 60);
  if (!idRl.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(idRl.retryAfter),
      },
    });
  }

  const ifMatch = ctx.request.headers.get('if-match') ?? undefined;

  const body = ctx.request.body;
  if (!body) {
    return jsonError(400, 'empty_body');
  }

  const obj = await ctx.env.SYNC_BUCKET.put(r2Key(auth.id), body, {
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
};

function quote(etag: string): string {
  if (etag.startsWith('"') && etag.endsWith('"')) return etag;
  return `"${etag}"`;
}

function stripQuotes(etag: string): string {
  if (etag.startsWith('"') && etag.endsWith('"')) return etag.slice(1, -1);
  if (etag.startsWith('W/"') && etag.endsWith('"')) return etag.slice(3, -1);
  return etag;
}
