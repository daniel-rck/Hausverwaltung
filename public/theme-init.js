/*
 * Apply the persisted theme before first paint, so a forced light/dark choice
 * doesn't flash the wrong colors on load.
 *
 * This lives in `public/` rather than inline in index.html on purpose: apps
 * that ship a Worker CSP can then keep `script-src 'self'` instead of pinning a
 * `sha256-` hash of an inline snippet — a hash that silently breaks the theme
 * the moment the snippet changes. Keep in sync with `themeInitScript` in
 * useTheme.ts, which is the same logic for apps that must inline it.
 *
 * Apps that persist the theme somewhere else (inside a settings blob, say)
 * adapt the read below; the contract is only that `data-theme` ends up on
 * <html> for a forced choice, and absent for "system".
 */
(() => {
  try {
    const t = localStorage.getItem("theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch {
    /* localStorage unavailable (private mode, quota) — fall back to the OS. */
  }
})();
