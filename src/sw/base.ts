/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

export type AppShellOptions = {
  /** Extra navigation paths the SPA fallback must leave to the network. */
  navigationDenylist?: RegExp[];
};

/**
 * The service-worker baseline, owned by web-base: precache the build, serve
 * index.html for every navigation (so an offline deep link like /mieter/123
 * opens the app instead of a browser error), and activate a new version only
 * when the page asks for it.
 */
export function registerAppShell({ navigationDenylist = [] }: AppShellOptions = {}): void {
  precacheAndRoute(self.__WB_MANIFEST);
  cleanupOutdatedCaches();
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL("index.html"), {
      denylist: [/^\/api(\/|$)/, /^\/healthz$/, ...navigationDenylist],
    }),
  );

  // No skipWaiting() on install. Workers Assets only serves the current
  // deploy, so a new worker that activated under an open page would evict the
  // old precache while the page still needs its lazy chunks. The page posts
  // SKIP_WAITING when the user accepts the update (UpdatePrompt).
  self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
  });
}
