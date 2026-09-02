import { type ReactNode, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { InstallButton } from "../InstallButton";
import { SyncStatusBadge } from "../sync/SyncStatusBadge";
import { ThemeToggle } from "../ThemeToggle";
import { IconButton } from "../ui/IconButton";
import { Building2, Search } from "../ui/icons";
import { ShortcutsModal } from "../ui/ShortcutsModal";
import { BottomNav, SidebarNav } from "./Nav";
import { PropertySelector } from "./PropertySelector";
import { UpdatePrompt } from "./UpdatePrompt";

const buildDate = new Date(__BUILD_DATE__).toLocaleDateString("de-DE");

export function AppShell({ children }: { children: ReactNode }) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const showHelp = useCallback(() => setShortcutsOpen(true), []);
  useKeyboardShortcuts(showHelp);

  return (
    <div className="min-h-screen flex flex-col bg-surface-muted">
      <a href="#main" className="skip-link">
        Zum Inhalt springen
      </a>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-3 sm:px-4 no-print">
        <div className="h-14 flex items-center justify-between gap-2">
          <Link
            to="/"
            className="flex items-center gap-2 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]/40 rounded-md px-1"
          >
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[--color-accent]/10 text-[--color-accent] dark:text-[--color-accent-dark]"
            >
              <Building2 size={14} strokeWidth={2} />
            </span>
            <span className="text-sm sm:text-[15px] font-semibold tracking-tight text-fg truncate">
              Hausverwaltung
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:flex">
              <SyncStatusBadge />
            </div>
            <PropertySelector />
            <IconButton
              variant="ghost"
              size="sm"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Tastenkürzel anzeigen (?)"
              title="Tastenkürzel (?)"
              icon={<Search size={16} strokeWidth={1.75} />}
              className="hidden sm:inline-flex"
            />
            <InstallButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 min-h-0">
        <SidebarNav />
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 p-3 md:p-5 pb-24 md:pb-5 overflow-x-hidden focus:outline-none"
        >
          {children}
        </main>
      </div>

      <BottomNav />

      <footer className="hidden md:flex flex-wrap justify-center items-center gap-x-3 gap-y-1 py-2 px-4 text-[11px] text-fg-subtle no-print">
        <span className="tabular-nums">
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
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
