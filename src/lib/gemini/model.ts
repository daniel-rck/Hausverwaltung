// Verified against ai.google.dev/gemini-api/docs/models (2026-06):
// "gemini-2.5-flash" is a stable, free-tier-eligible model id.
// Keep it a settings-overridable constant, never hardcode it at call sites.
export const DEFAULT_MODEL = "gemini-2.5-flash";
