import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Drawer } from '../ui/Drawer';
import { moduleAccent, type ModulKey } from '../ui/moduleAccent';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  accent?: ModulKey;
  group: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: '⌂', group: 'Übersicht' },
  { path: '/mieter', label: 'Mieter', icon: '👤', accent: 'mieter', group: 'Stammdaten' },
  { path: '/zaehler', label: 'Zähler', icon: '🔢', accent: 'zaehler', group: 'Verbrauch' },
  { path: '/wasser', label: 'Versorger', icon: '💧', accent: 'wasser', group: 'Verbrauch' },
  { path: '/nebenkosten', label: 'Nebenkosten', icon: '📋', accent: 'nebenkosten', group: 'Buchhaltung' },
  { path: '/finanzen', label: 'Finanzen', icon: '💶', accent: 'finanzen', group: 'Buchhaltung' },
  { path: '/rendite', label: 'Rendite', icon: '📈', accent: 'rendite', group: 'Buchhaltung' },
  { path: '/instandhaltung', label: 'Instandhaltung', icon: '🔧', accent: 'instandhaltung', group: 'Vorgänge' },
  { path: '/uebergabe', label: 'Übergabe', icon: '🔑', accent: 'uebergabe', group: 'Vorgänge' },
];

const groupOrder = ['Übersicht', 'Stammdaten', 'Verbrauch', 'Buchhaltung', 'Vorgänge'];

function activeClasses(accent: ModulKey | undefined): string {
  const a = moduleAccent(accent);
  if (a) {
    return `${a.pillBg} ${a.pillText} font-semibold`;
  }
  return 'bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100 font-semibold';
}

function activeBar(accent: ModulKey | undefined): string {
  const a = moduleAccent(accent);
  return a?.bg ?? 'bg-stone-700 dark:bg-stone-200';
}

export function SidebarNav() {
  const groups = groupOrder.map((g) => ({
    name: g,
    items: navItems.filter((i) => i.group === g),
  }));

  return (
    <nav
      aria-label="Hauptnavigation"
      className="hidden md:flex flex-col gap-4 w-56 shrink-0 p-4 no-print"
    >
      {groups.map((group) => (
        <div key={group.name} className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 px-3">
            {group.name}
          </p>
          {group.items.map((item) => {
            const a = moduleAccent(item.accent);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 ${
                    isActive
                      ? activeClasses(item.accent)
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r ${activeBar(item.accent)}`}
                      />
                    )}
                    <span aria-hidden="true" className={`text-lg ${a?.text ?? 'text-stone-500'}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

const bottomMain = navItems.slice(0, 4);
const bottomMore = navItems.slice(4);

export function BottomNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const moreActive = bottomMore.some((i) => location.pathname === i.path);

  return (
    <>
      <nav
        aria-label="Hauptnavigation Mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-stone-800 border-t border-stone-200 dark:border-stone-700 z-40 no-print"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        <div className="flex justify-around py-1">
          {bottomMain.map((item) => {
            const a = moduleAccent(item.accent);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 min-w-[60px] py-2 px-2 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 rounded-lg ${
                    isActive
                      ? `${a?.text ?? 'text-stone-900 dark:text-stone-100'} font-semibold`
                      : 'text-stone-500 dark:text-stone-400'
                  }`
                }
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Weitere Module öffnen"
            aria-expanded={open}
            className={`flex flex-col items-center gap-0.5 min-w-[60px] py-2 px-2 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 rounded-lg ${
              moreActive ? 'text-stone-900 dark:text-stone-100 font-semibold' : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ⋯
            </span>
            <span>Mehr</span>
          </button>
        </div>
      </nav>
      <Drawer open={open} onClose={() => setOpen(false)} title="Weitere Bereiche" side="bottom">
        <ul className="space-y-1">
          {bottomMore.map((item) => {
            const a = moduleAccent(item.accent);
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${
                      isActive
                        ? activeClasses(item.accent)
                        : 'text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700'
                    }`
                  }
                >
                  <span aria-hidden="true" className={`text-lg ${a?.text ?? ''}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </Drawer>
    </>
  );
}
