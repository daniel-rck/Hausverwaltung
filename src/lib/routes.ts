/**
 * Route paths. The app runs on a hash router (`#/mieter`), so these are the
 * paths after the `#`. Changing one breaks bookmarks and shared
 * `#/import/:payload` links — keep them stable.
 */
export const ROUTES = {
  home: "/",
  mieter: "/mieter",
  nebenkosten: "/nebenkosten",
  zaehler: "/zaehler",
  wasser: "/wasser",
  finanzen: "/finanzen",
  instandhaltung: "/instandhaltung",
  uebergabe: "/uebergabe",
  rendite: "/rendite",
  import: "/import/:payload",
  einstellungen: "/einstellungen",
  datenschutz: "/datenschutz",
} as const;

export type RouteKey = keyof typeof ROUTES;
