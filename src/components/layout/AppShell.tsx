import type { ReactNode } from 'react';
import { SidebarNav, BottomNav } from './Nav';
import { PropertySelector } from './PropertySelector';
import { useTheme } from '../../hooks/useTheme';

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-900">
      {/* Header */}
      <header className="bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 px-4 py-3 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-stone-800 dark:text-stone-100">
            Hausverwaltung
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <PropertySelector />
          <button
            onClick={toggle}
            className="p-2 text-sm rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors"
            title={theme === 'light' ? 'Dunkelmodus' : 'Hellmodus'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1">
        <SidebarNav />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
