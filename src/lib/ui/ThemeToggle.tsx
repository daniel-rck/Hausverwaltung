import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "./Button.tsx";
import { type Theme, useTheme } from "./useTheme.ts";

const CYCLE: Theme[] = ["system", "light", "dark"];

const NAME: Record<Theme, string> = { system: "System", light: "Hell", dark: "Dunkel" };

const ICON: Record<Theme, typeof Monitor> = { system: Monitor, light: Sun, dark: Moon };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = ICON[theme];
  const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length] ?? "system";
  // Name the current state *and* what a click does.
  const label = `Design: ${NAME[theme]} – wechseln zu ${NAME[next]}`;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
