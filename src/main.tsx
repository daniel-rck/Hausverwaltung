import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { ThemeProvider } from "./lib/hooks/useTheme";
import { syncService } from "./lib/sync/service";
import { ConfirmProvider, ErrorBoundary, ToastProvider } from "./lib/ui/ui";

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
