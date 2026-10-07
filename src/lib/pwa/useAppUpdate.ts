/// <reference types="vite-plugin-pwa/react" />
import { useRegisterSW } from "virtual:pwa-register/react";

const HOUR = 60 * 60 * 1000;

export type AppUpdate = {
  /** A new version is installed and waiting for the user's go. */
  needRefresh: boolean;
  /** The app was cached for offline use for the first time. */
  offlineReady: boolean;
  /** Activate the waiting version and reload every open tab. */
  reload: () => void;
  dismiss: () => void;
};

/**
 * Service-worker registration and update state, for any UI (UpdatePrompt, or
 * an app's own design system). Registers with `registerType: "prompt"`: a new
 * version waits until `reload()` — see src/sw/base.ts for why.
 */
export function useAppUpdate(): AppUpdate {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // A tab left open for days (a running timer, a kiosk) would otherwise
      // never look for a new version.
      setInterval(() => {
        if (document.visibilityState === "visible" && navigator.onLine) void registration.update();
      }, HOUR);
    },
  });
  return {
    needRefresh,
    offlineReady,
    reload: () => void updateServiceWorker(true),
    dismiss: () => {
      setNeedRefresh(false);
      setOfflineReady(false);
    },
  };
}
