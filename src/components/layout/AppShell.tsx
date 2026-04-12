import type { ReactNode } from 'react';
import { SidebarNav, BottomNav } from './Nav';
import { PropertySelector } from './PropertySelector';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-stone-800">
            Hausverwaltung
          </h1>
        </div>

        <PropertySelector />
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
