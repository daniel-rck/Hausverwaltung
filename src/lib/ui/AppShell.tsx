import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader.tsx";
import { AppNav, type NavItem } from "./AppNav.tsx";
import { InstallButton } from "./InstallButton.tsx";
import { OfflineIndicator } from "./OfflineIndicator.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

export type AppShellProps = {
  title: string;
  logo?: ReactNode;
  navItems: NavItem[];
  headerActions?: ReactNode;
  /**
   * Replaces the built-in theme toggle. The default is labelled in German;
   * an app with i18n passes its own translated toggle here rather than
   * shipping a second control somewhere else.
   */
  themeToggle?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  title,
  logo,
  navItems,
  headerActions,
  themeToggle,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-surface text-fg">
      {/* First focusable element: keyboard users skip the header and nav. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-2 focus:outline-accent-500"
      >
        Zum Inhalt springen
      </a>
      <AppHeader
        title={title}
        logo={logo}
        actions={
          <>
            {/* The always-present toggle comes first so it keeps its position
                while the conditional indicator and install button come and go. */}
            {themeToggle ?? <ThemeToggle />}
            <OfflineIndicator />
            <InstallButton />
            {headerActions}
          </>
        }
      />
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:block w-56 shrink-0 border-r border-border bg-surface-muted">
          {/* The aside spans the full content height for its border and
              background; the nav inside sticks below the header (h-14 plus the
              notch inset the header absorbs) as you scroll. */}
          <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))]">
            <AppNav items={navItems} variant="sidebar" />
          </div>
        </aside>
        {/* The window is the scroll container — the shell is min-h-screen and
            grows with content. Deliberately no `overflow-y-auto` here: an
            overflow container captures every descendant `position: sticky`
            without ever scrolling itself, which silently breaks sticky headers
            and toolbars anywhere in the page. `min-w-0` stops wide content
            (tables, code blocks) from stretching this flex item past the
            viewport. */}
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 focus:outline-hidden"
        >
          <div className="container mx-auto max-w-4xl px-4 py-6">{children}</div>
        </main>
      </div>
      {/* pb-[env(safe-area-inset-bottom)] keeps the bar clear of the iOS home
          indicator; the translucent background needs the blur to stay legible. */}
      <div className="md:hidden fixed bottom-0 inset-x-0 border-t border-border bg-surface/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <AppNav items={navItems} variant="bottom" />
      </div>
    </div>
  );
}
