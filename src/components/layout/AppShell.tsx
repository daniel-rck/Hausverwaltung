import type { ReactNode } from 'react';
import { SidebarNav, BottomNav } from './Nav';
import { useProperty } from '../../hooks/useProperty';

export function AppShell({ children }: { children: ReactNode }) {
  const { properties, activeProperty, setActivePropertyId, addProperty } =
    useProperty();

  const handleAddProperty = async () => {
    await addProperty({ name: 'Neues Objekt', address: '', units: 0 });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-stone-800">
            Hausverwaltung
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Objektwechsler */}
          {properties.length > 0 && (
            <select
              value={activeProperty?.id ?? ''}
              onChange={(e) => setActivePropertyId(Number(e.target.value))}
              className="text-sm border border-stone-300 rounded-lg px-3 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleAddProperty}
            className="text-sm px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors"
          >
            + Objekt
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
