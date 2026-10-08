/**
 * Cloudflare Worker entry point. The owned `worker/base.ts` routes `/api/*` to
 * `handleApi` (the sync backend: OTP pairing + R2 snapshots), answers
 * `/healthz`, 404s stale `/assets/*` and serves everything else from the static
 * assets binding (SPA mode in wrangler.toml).
 */

import { routeRequest } from "./base.ts";
import { handleObjectGet, handleObjectPut } from "./handlers/objects-data";
import { handlePairClaim } from "./handlers/pair-claim";
import { handlePairCreate } from "./handlers/pair-create";
import { jsonError } from "./lib/auth";
import type { Env } from "./lib/types";

const OBJECTS_PATH = /^\/api\/objects\/([^/]+)\/data\/?$/;

export default {
  fetch: (request, env, ctx) => routeRequest(request, env, ctx, handleApi),
} satisfies ExportedHandler<Env>;

async function handleApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  const method = request.method;

  // Frühzeitige Diagnose — ohne Bindings ist der Worker funktionsunfähig, und
  // eine ungefangene TypeError("Cannot read .get of undefined") landet als
  // nichtssagender 500. Lieber konkret zurückmelden, welche Bindung fehlt.
  if (!env.SYNC_BUCKET || !env.PAIR_KV) {
    const missing: string[] = [];
    if (!env.SYNC_BUCKET) missing.push("SYNC_BUCKET");
    if (!env.PAIR_KV) missing.push("PAIR_KV");
    return jsonError(503, `binding_missing:${missing.join(",")}`);
  }

  try {
    if (pathname === "/api/pair/create") {
      if (method !== "POST") return jsonError(405, "method_not_allowed");
      return await handlePairCreate(request, env);
    }

    if (pathname === "/api/pair/claim") {
      if (method !== "POST") return jsonError(405, "method_not_allowed");
      return await handlePairClaim(request, env);
    }

    const objectId = pathname.match(OBJECTS_PATH)?.[1];
    if (objectId) {
      if (method === "GET") return await handleObjectGet(request, env, objectId);
      if (method === "PUT") return await handleObjectPut(request, env, objectId);
      return jsonError(405, "method_not_allowed");
    }

    return jsonError(404, "not_found");
  } catch (err) {
    // Bewusst mit Message statt base.ts' generischem `{ error: "internal" }`:
    // der Sync-Client zeigt sie an, damit man im Netzwerktab debuggen kann.
    const message = err instanceof Error ? err.message : String(err);
    console.error("worker uncaught", err);
    return jsonError(500, `internal_error:${message}`);
  }
}
