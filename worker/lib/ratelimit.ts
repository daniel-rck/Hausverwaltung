import type { Env } from './types';

/**
 * KV-backed token-bucket rate limit. Atomic enough for our purposes:
 * on contention, two clients might both pass — acceptable for the small-scale
 * abuse prevention this system targets. KV TTL handles cleanup automatically.
 */
export async function rateLimit(
  env: Env,
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const kvKey = `rl:${key}`;
  const now = Math.floor(Date.now() / 1000);
  const raw = await env.PAIR_KV.get(kvKey);
  let count = 0;
  let resetAt = now + windowSec;
  if (raw) {
    const parsed = JSON.parse(raw) as { count: number; resetAt: number };
    if (parsed.resetAt > now) {
      count = parsed.count;
      resetAt = parsed.resetAt;
    }
  }
  count += 1;
  const remaining = Math.max(1, resetAt - now);
  // Cloudflare KV erlaubt expirationTtl erst ab 60s — sonst wirft put() 400.
  // Wir clampen den TTL nach oben, der `resetAt` im Wert bleibt unverändert,
  // sodass die Rate-Limit-Logik korrekt weiterzählt.
  const kvTtl = Math.max(60, remaining);
  await env.PAIR_KV.put(
    kvKey,
    JSON.stringify({ count, resetAt }),
    { expirationTtl: kvTtl },
  );
  if (count > limit) {
    return { allowed: false, retryAfter: remaining };
  }
  return { allowed: true, retryAfter: 0 };
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export function rateLimited(retryAfter: number): Response {
  return new Response(JSON.stringify({ error: 'rate_limited' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
    },
  });
}
