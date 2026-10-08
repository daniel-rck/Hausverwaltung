/** Join class names, skipping falsy parts. No clsx: concat is enough here. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Keyboard focus: a real outline, not a box-shadow ring. Forced-colors mode
 * (Windows high contrast) drops box-shadows, so a ring-only focus style
 * disappears there; an outline survives. Pair it with an outline colour
 * (`focus-visible:outline-accent-500`, or `-danger`).
 */
export const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2";
