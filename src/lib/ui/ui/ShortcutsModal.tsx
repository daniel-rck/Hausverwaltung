import { Modal } from "./Modal";

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: "Navigation",
    items: [
      { keys: ["g", "d"], description: "Dashboard" },
      { keys: ["g", "m"], description: "Mieter" },
      { keys: ["g", "z"], description: "Zähler" },
      { keys: ["g", "w"], description: "Versorger" },
      { keys: ["g", "n"], description: "Nebenkosten" },
      { keys: ["g", "f"], description: "Finanzen" },
      { keys: ["g", "r"], description: "Rendite" },
      { keys: ["g", "i"], description: "Instandhaltung" },
      { keys: ["g", "u"], description: "Übergabe" },
      { keys: ["g", "e"], description: "Einstellungen" },
    ],
  },
  {
    group: "Allgemein",
    items: [
      { keys: ["?"], description: "Diese Übersicht öffnen" },
      { keys: ["Esc"], description: "Modal/Drawer schließen" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-surface-muted text-[11px] font-mono font-medium text-fg">
      {children}
    </kbd>
  );
}

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tastenkürzel"
      description="Schnelle Navigation per Tastatur."
      size="md"
    >
      <div className="space-y-5">
        {SHORTCUTS.map((group) => (
          <div key={group.group}>
            <h3 className="text-[11px] uppercase tracking-wider font-semibold text-fg-muted mb-2">
              {group.group}
            </h3>
            <dl className="space-y-1.5">
              {group.items.map((s) => (
                <div key={s.keys.join("-")} className="flex items-center justify-between gap-3">
                  <dt className="text-sm text-fg">{s.description}</dt>
                  <dd className="flex items-center gap-1 shrink-0">
                    {s.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Modal>
  );
}
