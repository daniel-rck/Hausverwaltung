import { useCallback, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type UseInstallPromptResult = {
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

// Captured at module load, not in an effect: `beforeinstallprompt` can fire
// before a lazily rendered shell mounts, and a missed event never comes back.
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports a Macintosh user agent; touch support gives it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function useInstallPrompt(): UseInstallPromptResult {
  const event = useSyncExternalStore(
    subscribe,
    () => deferred,
    () => null,
  );
  const justInstalled = useSyncExternalStore(
    subscribe,
    () => installed,
    () => false,
  );

  const promptInstall = useCallback(async () => {
    const pending = deferred;
    if (!pending) return "unavailable" as const;
    // A prompt event can be used once; clear it whatever the outcome.
    deferred = null;
    emit();
    try {
      await pending.prompt();
      return (await pending.userChoice).outcome;
    } catch {
      return "unavailable" as const;
    }
  }, []);

  return {
    canInstall: event !== null,
    isIOS: detectIOS(),
    isStandalone: justInstalled || detectStandalone(),
    promptInstall,
  };
}
