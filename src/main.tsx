import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { ConfirmProvider, ErrorBoundary, ToastProvider } from "./components/ui";
import { ThemeProvider } from "./hooks/useTheme";
import { syncService } from "./sync/service";

// Sync-Service einmalig initialisieren (lädt Session, startet Poll-Loop, falls verbunden)
void syncService.init();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
