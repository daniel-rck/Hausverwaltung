import { Outlet, ScrollRestoration } from "react-router-dom";
import { PropertyProvider } from "./lib/hooks/useProperty";
import { AppShell } from "./lib/ui/layout/AppShell";

/**
 * The root layout route: the app's own shell (sidebar, bottom nav, property
 * selector, sync badge) around every page. Routes live in src/lib/router.tsx.
 */
export function App() {
  return (
    <PropertyProvider>
      <AppShell>
        <Outlet />
      </AppShell>
      <ScrollRestoration />
    </PropertyProvider>
  );
}
