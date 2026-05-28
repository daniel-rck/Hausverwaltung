import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { PropertyProvider } from './hooks/useProperty';
import { AppShell } from './components/layout/AppShell';
import { Skeleton, ErrorBoundary } from './components/ui';

const DashboardPage = lazy(() =>
  import('./modules/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const MieterPage = lazy(() =>
  import('./modules/mieter/MieterPage').then((m) => ({ default: m.MieterPage })),
);
const NebenkostenPage = lazy(() =>
  import('./modules/nebenkosten/NebenkostenPage').then((m) => ({ default: m.NebenkostenPage })),
);
const ZaehlerPage = lazy(() =>
  import('./modules/zaehler/ZaehlerPage').then((m) => ({ default: m.ZaehlerPage })),
);
const WasserPage = lazy(() =>
  import('./modules/wasser/WasserPage').then((m) => ({ default: m.WasserPage })),
);
const FinanzenPage = lazy(() =>
  import('./modules/finanzen/FinanzenPage').then((m) => ({ default: m.FinanzenPage })),
);
const InstandhaltungPage = lazy(() =>
  import('./modules/instandhaltung/InstandhaltungPage').then((m) => ({
    default: m.InstandhaltungPage,
  })),
);
const UebergabePage = lazy(() =>
  import('./modules/uebergabe/UebergabePage').then((m) => ({ default: m.UebergabePage })),
);
const RenditePage = lazy(() =>
  import('./modules/rendite/RenditePage').then((m) => ({ default: m.RenditePage })),
);
const ImportPage = lazy(() =>
  import('./modules/dashboard/ImportPage').then((m) => ({ default: m.ImportPage })),
);
const DatenschutzPage = lazy(() =>
  import('./modules/legal/DatenschutzPage').then((m) => ({ default: m.DatenschutzPage })),
);
const EinstellungenPage = lazy(() =>
  import('./modules/einstellungen/EinstellungenPage').then((m) => ({
    default: m.EinstellungenPage,
  })),
);

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton variant="text" width="40%" height="28px" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Skeleton height="80px" />
        <Skeleton height="80px" />
        <Skeleton height="80px" />
        <Skeleton height="80px" />
      </div>
      <Skeleton height="240px" />
    </div>
  );
}

/**
 * Routen-Container mit eigener ErrorBoundary: Crasht ein Modul, bleibt die
 * AppShell (inkl. Navigation) erhalten — der Nutzer kann wegnavigieren. Der
 * `key={pathname}` setzt den Fehlerzustand bei jedem Routenwechsel zurück,
 * sodass "Erneut versuchen" bzw. Navigieren die kaputte Seite verlässt.
 */
function RoutedContent() {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/mieter" element={<MieterPage />} />
          <Route path="/nebenkosten" element={<NebenkostenPage />} />
          <Route path="/zaehler" element={<ZaehlerPage />} />
          <Route path="/wasser" element={<WasserPage />} />
          <Route path="/finanzen" element={<FinanzenPage />} />
          <Route path="/instandhaltung" element={<InstandhaltungPage />} />
          <Route path="/uebergabe" element={<UebergabePage />} />
          <Route path="/rendite" element={<RenditePage />} />
          <Route path="/import/:payload" element={<ImportPage />} />
          <Route path="/einstellungen" element={<EinstellungenPage />} />
          <Route path="/datenschutz" element={<DatenschutzPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <HashRouter>
      <PropertyProvider>
        <AppShell>
          <RoutedContent />
        </AppShell>
      </PropertyProvider>
    </HashRouter>
  );
}
