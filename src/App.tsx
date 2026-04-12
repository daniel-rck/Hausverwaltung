import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PropertyProvider } from './hooks/useProperty';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { MieterPage } from './modules/mieter/MieterPage';
import { NebenkostenPage } from './modules/nebenkosten/NebenkostenPage';
import { ZaehlerPage } from './modules/zaehler/ZaehlerPage';
import { WasserPage } from './modules/wasser/WasserPage';
import { FinanzenPage } from './modules/finanzen/FinanzenPage';
import { InstandhaltungPage } from './modules/instandhaltung/InstandhaltungPage';
import { UebergabePage } from './modules/uebergabe/UebergabePage';
import { RenditePage } from './modules/rendite/RenditePage';

export function App() {
  return (
    <HashRouter>
      <PropertyProvider>
        <AppShell>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </PropertyProvider>
    </HashRouter>
  );
}
