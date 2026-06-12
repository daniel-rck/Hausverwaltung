export type ExtractionErrorKind =
  | "auth" // HTTP 400/403 — invalid key
  | "rate-limit" // HTTP 429
  | "server" // HTTP 5xx
  | "network" // fetch failed / offline
  | "unparsable"; // empty or non-JSON response

const USER_MESSAGES: Record<ExtractionErrorKind, string> = {
  auth: "API-Key ungültig — in den Einstellungen prüfen.",
  "rate-limit": "Rate-Limit erreicht — bitte kurz warten und erneut versuchen.",
  server: "Gemini-Server nicht erreichbar — bitte später erneut versuchen.",
  network: "Keine Verbindung — bitte Internetzugang prüfen.",
  unparsable: "Abrechnung konnte nicht gelesen werden — bitte manuell erfassen.",
};

export class ExtractionError extends Error {
  readonly kind: ExtractionErrorKind;

  constructor(kind: ExtractionErrorKind) {
    // Never include response bodies or the API key in the message.
    super(USER_MESSAGES[kind]);
    this.name = "ExtractionError";
    this.kind = kind;
  }
}

export function errorKindFromStatus(status: number): ExtractionErrorKind {
  if (status === 429) return "rate-limit";
  if (status >= 500) return "server";
  return "auth"; // 400/403 and other client errors → key/config problem
}
