// The request router every app's Worker shares. Never edit this file —
// `web-base update` overwrites it; route your own endpoints in handleApi()
// in worker/index.ts.

type ApiHandler<E> = (request: Request, env: E, ctx: ExecutionContext) => Promise<Response>;

// public/_headers only applies to static-asset responses, never to responses
// the Worker generates, so the Worker sets its own baseline.
const WORKER_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

/**
 * - `/healthz` → `{ ok: true }`
 * - `/api` and `/api/*` → `handleApi`, behind an error boundary: a throw
 *   becomes a logged `500 { error: "internal" }` instead of an exception page.
 * - `/assets/*` → 404. The Worker only sees it when no asset matched — a
 *   hashed file from an older deploy (wrangler.toml sets no run_worker_first,
 *   which would hide these from the Worker). In SPA mode the assets binding
 *   would answer with index.html and a 200, which the browser then runs as JS.
 * - everything else → the static assets (SPA fallback included).
 */
export async function routeRequest<E extends { ASSETS: Fetcher }>(
  request: Request,
  env: E,
  ctx: ExecutionContext,
  handleApi: ApiHandler<E>,
): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === "/healthz") return withWorkerHeaders(json({ ok: true }));

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    try {
      return withWorkerHeaders(await handleApi(request, env, ctx));
    } catch (err) {
      // The message only: stacks and request data don't belong in the logs.
      console.error("[api]", err instanceof Error ? err.message : String(err));
      return withWorkerHeaders(json({ error: "internal" }, 500));
    }
  }

  if (pathname.startsWith("/assets/")) {
    return withWorkerHeaders(new Response("Not Found", { status: 404 }));
  }

  return env.ASSETS.fetch(request);
}

/** A JSON response. Error bodies use a stable lowercase code: `{ error: "not_found" }`. */
export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

/**
 * Adds the baseline headers a handler didn't set itself. A WebSocket upgrade
 * (101) passes through untouched: its response carries the socket.
 */
function withWorkerHeaders(response: Response): Response {
  if (response.status === 101) return response;
  const missing = Object.entries(WORKER_HEADERS).filter(([name]) => !response.headers.has(name));
  if (missing.length === 0) return response;
  // Headers of a fetched response are immutable; a copy's are not.
  const patched = new Response(response.body, response);
  for (const [name, value] of missing) patched.headers.set(name, value);
  return patched;
}
