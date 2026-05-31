import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

export type UseThemeResult = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
};

const STORAGE_KEY = "theme";

/**
 * Inline this in `index.html` <head> before the stylesheet to set `data-theme`
 * from localStorage before first paint, avoiding a flash of the wrong theme.
 * Keep in sync with the `postInstall` note in this template's manifest.json.
 */
export const themeInitScript =
  `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");` +
  `if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());
  const [systemDark, setSystemDark] = useState<boolean>(() => systemPrefersDark());

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, []);

  // Reconcile the DOM (which the inline init script may have set) with state.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Keep resolvedTheme live when following the system in "system" mode.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  return { theme, resolvedTheme, setTheme };
}
