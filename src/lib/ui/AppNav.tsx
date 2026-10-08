import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn, FOCUS_RING } from "./cn.ts";

export type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
};

export type AppNavProps = {
  items: NavItem[];
  variant: "sidebar" | "bottom";
};

export function AppNav({ items, variant }: AppNavProps) {
  if (variant === "sidebar") {
    return (
      <nav className="w-full p-3 space-y-1" aria-label="Hauptnavigation">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors min-w-0",
                FOCUS_RING,
                "focus-visible:outline-accent-500",
                isActive
                  ? "bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200"
                  : "text-fg-muted hover:bg-surface-sunken hover:text-fg",
              )
            }
          >
            <span aria-hidden="true">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex h-16 items-stretch px-2" aria-label="Hauptnavigation">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          className={cn(
            "group flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-md",
            FOCUS_RING,
            "focus-visible:outline-accent-500 focus-visible:-outline-offset-2",
          )}
        >
          {({ isActive }) => (
            <>
              {/* The active state is a pill behind the icon rather than a color
                  change on both icon and label: at this size a tint alone is
                  easy to miss, and the pill keeps the touch target legible. */}
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-8 min-w-14 place-items-center rounded-full",
                  "transition-[background-color,color] duration-[var(--duration-base)] ease-[var(--ease-out-quart)]",
                  isActive
                    ? "bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200"
                    : "text-fg-muted group-hover:text-fg",
                )}
              >
                {item.icon}
              </span>
              <span
                className={cn(
                  "max-w-full truncate",
                  isActive ? "text-accent-600 dark:text-accent-300" : "text-fg-muted",
                )}
              >
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
