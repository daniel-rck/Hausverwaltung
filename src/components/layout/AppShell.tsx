import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SidebarNav, BottomNav } from './Nav';
import { PropertySelector } from './PropertySelector';
import { UpdatePrompt } from './UpdatePrompt';
import { useTheme } from '../../hooks/useTheme';
import { SyncStatusBadge } from '../sync/SyncStatusBadge';
import { IconButton } from '../ui/IconButton';

const buildDate = new Date(__BUILD_DATE__).toLocaleDateString('de-DE');

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-900">
      <a href="#main" className="skip-link">
        Zum Inhalt springen
      </a>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-stone-800/90 backdrop-blur border-b border-stone-200 dark:border-stone-700 px-3 sm:px-4 no-print">
        <div className="h-14 flex items-center justify-between gap-2">
          <Link
            to="/"
            className="flex items-center gap-2 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 rounded-lg px-1"
          >
            <span aria-hidden="true" className="text-xl">
              🏠
            </span>
            <span className="text-base sm:text-lg font-semibold text-stone-800 dark:text-stone-100 truncate">
              Hausverwaltung
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:flex">
              <SyncStatusBadge />
            </div>
            <PropertySelector />
            <IconButton
              variant="subtle"
              size="md"
              onClick={toggle}
              aria-label={theme === 'light' ? 'Dunkelmodus aktivieren' : 'Hellmodus aktivieren'}
              title={theme === 'light' ? 'Dunkelmodus' : 'Hellmodus'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </IconButton>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 min-h-0">
        <SidebarNav />
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-x-hidden focus:outline-none"
        >
          {children}
        </main>
      </div>

      <BottomNav />

      <footer className="hidden md:flex flex-wrap justify-center items-center gap-x-3 gap-y-1 py-2 px-4 text-xs text-stone-400 dark:text-stone-500 no-print">
        <span>
          v{__APP_VERSION__} · {buildDate}
        </span>
        <span aria-hidden="true">·</span>
        <Link to="/datenschutz" className="hover:underline">
          Datenschutz
        </Link>
        <a
          href="https://github.com/daniel-rck/Hausverwaltung"
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          GitHub
        </a>
      </footer>

      <UpdatePrompt />
    </div>
  );
}
