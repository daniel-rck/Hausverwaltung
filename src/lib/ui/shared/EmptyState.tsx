import type { ReactNode } from "react";
import { Button } from "../ui/Button";

interface EmptyStateProps {
  /** Lucide-Icon-Element (z.B. `<Users size={24} />`) oder beliebiger ReactNode. */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void } | ReactNode;
}

function isActionObject(
  action: EmptyStateProps["action"],
): action is { label: string; onClick: () => void } {
  return (
    typeof action === "object" &&
    action !== null &&
    "label" in (action as Record<string, unknown>) &&
    "onClick" in (action as Record<string, unknown>)
  );
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <span
          aria-hidden="true"
          className="mb-3 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-surface-sunken text-fg-muted"
        >
          {icon}
        </span>
      )}
      <h3 className="text-base font-semibold text-fg tracking-tight mb-1">{title}</h3>
      {description && <p className="text-sm text-fg-muted max-w-xs mb-4">{description}</p>}
      {action &&
        (isActionObject(action) ? (
          <Button variant="primary" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : (
          action
        ))}
    </div>
  );
}
