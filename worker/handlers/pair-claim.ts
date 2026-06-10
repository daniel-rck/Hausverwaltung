import { jsonError } from "../lib/auth";
import { clientIp, rateLimit, rateLimited } from "../lib/ratelimit";
import type { Env, PairClaimRequest, PairClaimResponse } from "../lib/types";

export async function handlePairClaim(request: Request, env: Env): Promise<Response> {
  const ip = clientIp(request);
  const rl = await rateLimit(env, `pair-claim:${ip}`, 10, 900);
  if (!rl.allowed) return rateLimited(rl.retryAfter);

  let body: PairClaimRequest;
  try {
    body = (await request.json()) as PairClaimRequest;
  } catch {
    return jsonError(400, "invalid_json");
  }

  if (!body.otp || !/^\d{6}$/.test(body.otp)) {
    return jsonError(400, "invalid_otp");
  }

  const kvKey = `otp:${body.otp}`;
  const value = await env.PAIR_KV.get(kvKey);
  if (!value) {
    return jsonError(404, "expired_or_unknown");
  }

  // One-shot delete before returning. get→delete ist auf KV nicht atomar:
  // zwei zeitgleiche Claims können beide das Payload erhalten. Akzeptabel,
  // weil das Secret OTP-verschlüsselt ist — wer claimt, muss den OTP ohnehin
  // kennen; das Löschen verhindert nur spätere Replays.
  await env.PAIR_KV.delete(kvKey);

  const parsed = JSON.parse(value) as PairClaimResponse;
  return new Response(JSON.stringify(parsed), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
