import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "./primitives.tsx";
import { type Theme, useTheme } from "./useTheme.ts";

const CYCLE: Theme[] = ["system", "light", "dark"];

const LABEL: Record<Theme, string> = {
  system: "Design: System",
  light: "Design: Hell",
  dark: "Design: Dunkel",
};

const ICON: Record<Theme, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = ICON[theme];
  const label = LABEL[theme];

  const handleClick = () => {
    const index = CYCLE.indexOf(theme);
    const next = CYCLE[(index + 1) % CYCLE.length] ?? "system";
    setTheme(next);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} aria-label={label} title={label}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
