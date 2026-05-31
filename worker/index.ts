/**
 * Cloudflare Worker entry point. Routes `/api/*` to sync-backend handlers,
 * everything else passes through to the static assets binding (the SPA).
 */

import { handleObjectGet, handleObjectPut } from "./handlers/objects-data";
import { handlePairClaim } from "./handlers/pair-claim";
import { handlePairCreate } from "./handlers/pair-create";
import { jsonError } from "./lib/auth";
import type { Env } from "./lib/types";

const OBJECTS_PATH = /^\/api\/objects\/([^/]+)\/data\/?$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // Frühzeitige Diagnose für /api/* — ohne Bindings ist der Worker
    // funktionsunfähig, und eine ungefangene TypeError("Cannot read .get of
    // undefined") landet als nichtssagender 500. Lieber konkret zurückmelden,
    // welche Bindung fehlt.
    if (pathname.startsWith("/api/")) {
      if (!env.SYNC_BUCKET || !env.PAIR_KV) {
        const missing: string[] = [];
        if (!env.SYNC_BUCKET) missing.push("SYNC_BUCKET");
        if (!env.PAIR_KV) missing.push("PAIR_KV");
        return jsonError(503, `binding_missing:${missing.join(",")}`);
      }
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

      const objMatch = pathname.match(OBJECTS_PATH);
      if (objMatch) {
        const id = objMatch[1];
        if (method === "GET") return await handleObjectGet(request, env, id);
        if (method === "PUT") return await handleObjectPut(request, env, id);
        return jsonError(405, "method_not_allowed");
      }

      if (pathname.startsWith("/api/")) {
        return jsonError(404, "not_found");
      }

      // Static assets fallthrough — also handles SPA index.html for unknown routes
      // because of `not_found_handling = "single-page-application"` in wrangler.toml.
      return env.ASSETS.fetch(request);
    } catch (err) {
      // Sonst sieht der Client nur einen leeren 500 — wir geben Stack +
      // Message zurück, damit man im Browser-Netzwerktab debuggen kann.
      const message = err instanceof Error ? err.message : String(err);
      console.error("worker uncaught", err);
      return jsonError(500, `internal_error:${message}`);
    }
  },
} satisfies ExportedHandler<Env>;
