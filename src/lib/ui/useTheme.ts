import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

export type UseThemeResult = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
};

const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * The anti-flash snippet, as a string. Prefer the shipped `public/theme-init.js`
 * and a `<script src="/theme-init.js">` tag: an external file lets a CSP stay
 * `script-src 'self'` instead of pinning a `sha256-` hash that breaks
 * silently whenever the snippet changes. This export exists for apps that must
 * inline it anyway. Keep the two in sync.
 */
export const themeInitScript =
  `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");` +
  `if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // localStorage can throw outright, not just return null: Safari private
    // mode and "block all cookies" both do. Fall back to following the OS.
  }
  return "system";
}

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

// One store for the whole page: every useTheme() call — the header toggle, a
// chart reading resolvedTheme — sees the same value, and other tabs follow
// through the `storage` event.
let current: Theme | undefined;
const listeners = new Set<() => void>();

function getTheme(): Theme {
  current ??= readStoredTheme();
  return current;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  // `key === null` is localStorage.clear() in another tab ("Alle Daten löschen").
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  current = readStoredTheme();
  applyTheme(current);
  emit();
}

function subscribeTheme(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("storage", onStorage);
    // Reconcile the DOM (which theme-init.js may have set) with the store.
    applyTheme(getTheme());
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function setTheme(next: Theme): void {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Persistence is best-effort; the choice still applies for this session.
  }
  applyTheme(next);
  emit();
}

// jsdom (and old browsers) have no matchMedia: follow "light" there.
const hasMatchMedia = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";

function systemPrefersDark(): boolean {
  return hasMatchMedia() && window.matchMedia(DARK_QUERY).matches;
}

function subscribeSystem(listener: () => void): () => void {
  if (!hasMatchMedia()) return () => {};
  const mql = window.matchMedia(DARK_QUERY);
  mql.addEventListener("change", listener);
  return () => mql.removeEventListener("change", listener);
}

export function useTheme(): UseThemeResult {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "system" as const);
  const systemDark = useSyncExternalStore(subscribeSystem, systemPrefersDark, () => false);
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  return { theme, resolvedTheme, setTheme };
}
