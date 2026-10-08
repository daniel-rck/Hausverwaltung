import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "./lib/router.tsx";
import { syncService } from "./lib/sync/service";
import { UpdatePrompt } from "./lib/ui/layout/UpdatePrompt";
import { ConfirmProvider, ErrorBoundary, ToastProvider } from "./lib/ui/ui";

// Sync-Service einmalig initialisieren (lädt Session, startet Poll-Loop, falls verbunden)
void syncService.init();

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
          <UpdatePrompt />
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
