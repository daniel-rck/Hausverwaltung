/// <reference lib="webworker" />
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

// Wird zur Build-Zeit von vite-plugin-pwa (injectManifest) befüllt.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Google-Fonts (CSS + Webfonts) offline-fähig cachen – ersetzt das frühere
// workbox.runtimeCaching aus der generateSW-Konfiguration.
const YEAR = 365 * 24 * 60 * 60;
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new CacheFirst({
    cacheName: "google-fonts-css",
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: YEAR })],
  }),
);
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: YEAR })],
  }),
);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
