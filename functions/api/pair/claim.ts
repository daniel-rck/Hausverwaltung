import type { Env, PairClaimRequest, PairClaimResponse } from '../_lib/types';
import { jsonError } from '../_lib/auth';
import { rateLimit, clientIp } from '../_lib/ratelimit';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `pair-claim:${ip}`, 10, 900);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rl.retryAfter),
      },
    });
  }

  let body: PairClaimRequest;
  try {
    body = (await ctx.request.json()) as PairClaimRequest;
  } catch {
    return jsonError(400, 'invalid_json');
  }

  if (!body.otp || !/^\d{6}$/.test(body.otp)) {
    return jsonError(400, 'invalid_otp');
  }

  const kvKey = `otp:${body.otp}`;
  const value = await ctx.env.PAIR_KV.get(kvKey);
  if (!value) {
    return jsonError(404, 'expired_or_unknown');
  }

  // One-shot delete before returning.
  await ctx.env.PAIR_KV.delete(kvKey);

  const parsed = JSON.parse(value) as PairClaimResponse;
  return new Response(JSON.stringify(parsed), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
