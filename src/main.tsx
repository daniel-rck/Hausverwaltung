import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ThemeProvider } from './hooks/useTheme';
import { App } from './App';
import { syncService } from './sync/service';

// Sync-Service einmalig initialisieren (lädt Session, startet Poll-Loop, falls verbunden)
void syncService.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
