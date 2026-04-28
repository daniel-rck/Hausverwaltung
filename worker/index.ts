/**
 * Cloudflare Worker entry point. Routes `/api/*` to sync-backend handlers,
 * everything else passes through to the static assets binding (the SPA).
 */

import type { Env } from './lib/types';
import { jsonError } from './lib/auth';
import { handlePairCreate } from './handlers/pair-create';
import { handlePairClaim } from './handlers/pair-claim';
import {
  handleObjectGet,
  handleObjectPut,
} from './handlers/objects-data';

const OBJECTS_PATH = /^\/api\/objects\/([^/]+)\/data\/?$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (pathname === '/api/pair/create') {
      if (method !== 'POST') return jsonError(405, 'method_not_allowed');
      return handlePairCreate(request, env);
    }

    if (pathname === '/api/pair/claim') {
      if (method !== 'POST') return jsonError(405, 'method_not_allowed');
      return handlePairClaim(request, env);
    }

    const objMatch = pathname.match(OBJECTS_PATH);
    if (objMatch) {
      const id = objMatch[1];
      if (method === 'GET') return handleObjectGet(request, env, id);
      if (method === 'PUT') return handleObjectPut(request, env, id);
      return jsonError(405, 'method_not_allowed');
    }

    if (pathname.startsWith('/api/')) {
      return jsonError(404, 'not_found');
    }

    // Static assets fallthrough — also handles SPA index.html for unknown routes
    // because of `not_found_handling = "single-page-application"` in wrangler.toml.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
