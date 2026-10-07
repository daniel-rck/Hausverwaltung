/// <reference lib="webworker" />
import { registerAppShell } from "./base.ts";

// Precache, offline navigation and prompt-based updates (owned: base.ts).
// The former Google-Fonts runtime caches are gone: the fonts ship as
// @fontsource packages in the precache, so the app loads nothing cross-origin.
registerAppShell();
