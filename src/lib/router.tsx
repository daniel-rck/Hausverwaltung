import { createHashRouter } from "react-router-dom";
import { App } from "../App.tsx";
import { ROUTES } from "./routes.ts";
import { NotFound } from "./routing/NotFound.tsx";
import { RouteError } from "./routing/RouteError.tsx";
import { RouteFallback } from "./routing/RouteFallback.tsx";

/*
 * A hash router, not the template's browser router (accepted deviation, see
 * CLAUDE.md): data is shared through hash-encoded links (`#/import/:payload`),
 * which never reach the server, and the app needs no server routing at all.
 * Every URL stays exactly what the former <HashRouter> served.
 */
export const router = createHashRouter([
  {
    // The root layout route: the app's own AppShell around every page (src/App.tsx).
    path: ROUTES.home,
    Component: App,
    ErrorBoundary: RouteError,
    HydrateFallback: RouteFallback,
    children: [
      {
        // A page error renders inside the shell, so the navigation keeps working.
        ErrorBoundary: RouteError,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import("../features/dashboard/DashboardPage.tsx")).DashboardPage,
            }),
          },
          {
            path: ROUTES.mieter,
            lazy: async () => ({
              Component: (await import("../features/mieter/MieterPage.tsx")).MieterPage,
            }),
          },
          {
            path: ROUTES.nebenkosten,
            lazy: async () => ({
              Component: (await import("../features/nebenkosten/NebenkostenPage.tsx"))
                .NebenkostenPage,
            }),
          },
          {
            path: ROUTES.zaehler,
            lazy: async () => ({
              Component: (await import("../features/zaehler/ZaehlerPage.tsx")).ZaehlerPage,
            }),
          },
          {
            path: ROUTES.wasser,
            lazy: async () => ({
              Component: (await import("../features/wasser/WasserPage.tsx")).WasserPage,
            }),
          },
          {
            path: ROUTES.finanzen,
            lazy: async () => ({
              Component: (await import("../features/finanzen/FinanzenPage.tsx")).FinanzenPage,
            }),
          },
          {
            path: ROUTES.instandhaltung,
            lazy: async () => ({
              Component: (await import("../features/instandhaltung/InstandhaltungPage.tsx"))
                .InstandhaltungPage,
            }),
          },
          {
            path: ROUTES.uebergabe,
            lazy: async () => ({
              Component: (await import("../features/uebergabe/UebergabePage.tsx")).UebergabePage,
            }),
          },
          {
            path: ROUTES.rendite,
            lazy: async () => ({
              Component: (await import("../features/rendite/RenditePage.tsx")).RenditePage,
            }),
          },
          {
            path: ROUTES.import,
            lazy: async () => ({
              Component: (await import("../features/dashboard/ImportPage.tsx")).ImportPage,
            }),
          },
          {
            path: ROUTES.einstellungen,
            lazy: async () => ({
              Component: (await import("../features/einstellungen/EinstellungenPage.tsx"))
                .EinstellungenPage,
            }),
          },
          {
            path: ROUTES.datenschutz,
            lazy: async () => ({
              Component: (await import("../features/legal/DatenschutzPage.tsx")).DatenschutzPage,
            }),
          },
          { path: "*", Component: NotFound },
        ],
      },
    ],
  },
]);
