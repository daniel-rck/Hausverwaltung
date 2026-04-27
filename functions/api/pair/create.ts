import type { Env, PairCreateRequest, PairCreateResponse } from '../_lib/types';
import { jsonError } from '../_lib/auth';
import { rateLimit, clientIp } from '../_lib/ratelimit';

const TTL_SEC = 300;

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `pair-create:${ip}`, 5, 60);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rl.retryAfter),
      },
    });
  }

  let body: PairCreateRequest;
  try {
    body = (await ctx.request.json()) as PairCreateRequest;
  } catch {
    return jsonError(400, 'invalid_json');
  }

  if (
    !body.otp ||
    !/^\d{6}$/.test(body.otp) ||
    !body.wrappedSecret ||
    !body.iv ||
    !body.salt ||
    !body.nonce
  ) {
    return jsonError(400, 'invalid_payload');
  }

  // Reject ciphertext that's larger than expected (defensive — wrappedSecret
  // is always 48-ish bytes base64 for a 32-byte secret + 16-byte AES-GCM tag).
  if (
    body.wrappedSecret.length > 256 ||
    body.iv.length > 64 ||
    body.salt.length > 64 ||
    body.nonce.length > 64
  ) {
    return jsonError(400, 'payload_too_large');
  }

  const kvKey = `otp:${body.otp}`;
  const existing = await ctx.env.PAIR_KV.get(kvKey);
  if (existing) {
    return jsonError(409, 'otp_collision');
  }

  const expiresAt = Date.now() + TTL_SEC * 1000;
  const value = JSON.stringify({
    wrappedSecret: body.wrappedSecret,
    iv: body.iv,
    salt: body.salt,
    nonce: body.nonce,
  });
  await ctx.env.PAIR_KV.put(kvKey, value, { expirationTtl: TTL_SEC });

  const res: PairCreateResponse = { expiresAt };
  return new Response(JSON.stringify(res), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
