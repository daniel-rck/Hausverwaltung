import { NavLink } from 'react-router-dom';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  color: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: '⌂', color: 'text-stone-600' },
  { path: '/mieter', label: 'Mieter', icon: '👤', color: 'text-green-600' },
  { path: '/nebenkosten', label: 'Nebenkosten', icon: '📋', color: 'text-amber-600' },
  { path: '/zaehler', label: 'Zähler', icon: '🔢', color: 'text-violet-600' },
  { path: '/wasser', label: 'Wasser', icon: '💧', color: 'text-cyan-600' },
  { path: '/finanzen', label: 'Finanzen', icon: '💶', color: 'text-emerald-600' },
  { path: '/instandhaltung', label: 'Instandhaltung', icon: '🔧', color: 'text-rose-600' },
  { path: '/uebergabe', label: 'Übergabe', icon: '🔑', color: 'text-blue-600' },
  { path: '/rendite', label: 'Rendite', icon: '📈', color: 'text-yellow-600' },
];

export function SidebarNav() {
  return (
    <nav className="hidden md:flex flex-col gap-1 w-56 shrink-0 p-4 no-print">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200'
            }`
          }
        >
          <span className={`text-lg ${item.color}`}>{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-stone-800 border-t border-stone-200 dark:border-stone-700 z-50 no-print">
      <div className="flex justify-around py-1">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${
                isActive ? 'text-stone-900 dark:text-stone-100 font-semibold' : 'text-stone-500 dark:text-stone-400'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <NavLink
          to="/finanzen"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${
              isActive ? 'text-stone-900 dark:text-stone-100 font-semibold' : 'text-stone-500 dark:text-stone-400'
            }`
          }
        >
          <span className="text-lg">⋯</span>
          Mehr
        </NavLink>
      </div>
    </nav>
  );
}
