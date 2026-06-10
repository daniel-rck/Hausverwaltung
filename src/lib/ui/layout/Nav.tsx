import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Drawer } from "../ui/Drawer";
import { type ModulIconKey, ModulIcons, MoreHorizontal } from "../ui/icons";
import { type ModulKey, moduleAccent } from "../ui/moduleAccent";

interface NavItem {
  path: string;
  label: string;
  iconKey: ModulIconKey;
  accent?: ModulKey;
  group: string;
}

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", iconKey: "dashboard", group: "Übersicht" },
  { path: "/mieter", label: "Mieter", iconKey: "mieter", accent: "mieter", group: "Stammdaten" },
  { path: "/zaehler", label: "Zähler", iconKey: "zaehler", accent: "zaehler", group: "Verbrauch" },
  { path: "/wasser", label: "Versorger", iconKey: "wasser", accent: "wasser", group: "Verbrauch" },
  {
    path: "/nebenkosten",
    label: "Nebenkosten",
    iconKey: "nebenkosten",
    accent: "nebenkosten",
    group: "Buchhaltung",
  },
  {
    path: "/finanzen",
    label: "Finanzen",
    iconKey: "finanzen",
    accent: "finanzen",
    group: "Buchhaltung",
  },
  {
    path: "/rendite",
    label: "Rendite",
    iconKey: "rendite",
    accent: "rendite",
    group: "Buchhaltung",
  },
  {
    path: "/instandhaltung",
    label: "Instandhaltung",
    iconKey: "instandhaltung",
    accent: "instandhaltung",
    group: "Vorgänge",
  },
  {
    path: "/uebergabe",
    label: "Übergabe",
    iconKey: "uebergabe",
    accent: "uebergabe",
    group: "Vorgänge",
  },
  { path: "/einstellungen", label: "Einstellungen", iconKey: "einstellungen", group: "System" },
];

const groupOrder = ["Übersicht", "Stammdaten", "Verbrauch", "Buchhaltung", "Vorgänge", "System"];

function activeBar(accent: ModulKey | undefined): string {
  const a = moduleAccent(accent);
  return a?.bar ?? "bg-zinc-900 dark:bg-zinc-100";
}

export function SidebarNav() {
  const groups = groupOrder.map((g) => ({
    name: g,
    items: navItems.filter((i) => i.group === g),
  }));

  return (
    <nav
      aria-label="Hauptnavigation"
      className="hidden md:flex flex-col gap-4 w-52 shrink-0 p-3 no-print border-r border-zinc-200/60 dark:border-zinc-800/60"
    >
      {groups.map((group) => (
        <div key={group.name} className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle px-2.5 mb-1">
            {group.name}
          </p>
          {group.items.map((item) => {
            const Icon = ModulIcons[item.iconKey];
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]/40 ${
                    isActive
                      ? "bg-surface-sunken/80 text-fg font-medium"
                      : "text-fg-muted hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 hover:text-fg"
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
                    <Icon
                      size={16}
                      strokeWidth={1.75}
                      className={isActive ? "text-fg" : "text-fg-muted"}
                      aria-hidden="true"
                    />
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
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-border z-40 no-print"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <div className="flex justify-around py-1">
          {bottomMain.map((item) => {
            const Icon = ModulIcons[item.iconKey];
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-0.5 min-w-[60px] py-2 px-2 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]/40 rounded-md ${
                    isActive
                      ? "text-[--color-accent] dark:text-[--color-accent-dark] font-semibold"
                      : "text-fg-muted"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className={`absolute top-0 left-3 right-3 h-0.5 rounded-b ${activeBar(item.accent)}`}
                      />
                    )}
                    <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Weitere Module öffnen"
            aria-expanded={open}
            className={`flex flex-col items-center gap-0.5 min-w-[60px] py-2 px-2 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]/40 rounded-md ${
              moreActive
                ? "text-[--color-accent] dark:text-[--color-accent-dark] font-semibold"
                : "text-fg-muted"
            }`}
          >
            <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>Mehr</span>
          </button>
        </div>
      </nav>
      <Drawer open={open} onClose={() => setOpen(false)} title="Weitere Bereiche" side="bottom">
        <ul className="space-y-0.5">
          {bottomMore.map((item) => {
            const Icon = ModulIcons[item.iconKey];
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === "/"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-surface-sunken text-fg font-medium"
                        : "text-fg hover:bg-surface-muted/60"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r ${activeBar(item.accent)}`}
                        />
                      )}
                      <Icon
                        size={18}
                        strokeWidth={1.75}
                        className="text-fg-muted"
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </Drawer>
    </>
  );
}
