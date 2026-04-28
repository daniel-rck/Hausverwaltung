import { deriveSyncId, timingSafeEqual } from './crypto';

/**
 * Validates that the Bearer token's derived id equals the URL `:id` segment.
 * Returns the secret on success, null on failure. The Worker stores no user
 * table — the fact that `sha256(secret)[..16]` matches the path IS the auth.
 */
export async function verifyBearerForId(
  request: Request,
  urlId: string,
): Promise<string | null> {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const secret = auth.slice(7).trim();
  if (!secret) return null;
  const derived = await deriveSyncId(secret);
  return timingSafeEqual(derived, urlId) ? secret : null;
}

export function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
