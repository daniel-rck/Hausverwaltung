// The only module that touches localStorage for the Gemini BYO-key settings.
// Deliberately NOT in db.settings: the key must never end up in the E2E sync
// payload or in JSON exports, and it must never appear in URLs, logs or errors.
import { DEFAULT_MODEL } from "./model";

const KEY_API_KEY = "gemini-api-key";
const KEY_MODEL = "gemini-model";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota) — settings stay session-local.
  }
}

export function getApiKey(): string {
  return read(KEY_API_KEY) ?? "";
}

export function setApiKey(value: string): void {
  write(KEY_API_KEY, value.trim());
}

export function getModel(): string {
  const stored = read(KEY_MODEL);
  return stored && stored.trim() !== "" ? stored : DEFAULT_MODEL;
}

export function setModel(value: string): void {
  write(KEY_MODEL, value.trim());
}
