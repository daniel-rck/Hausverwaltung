import type { ReactNode } from "react";
import { StatusIcons } from "./icons";

type CalloutVariant = "info" | "success" | "warning" | "danger";

type CalloutProps = {
  variant?: CalloutVariant;
  title?: ReactNode;
  children?: ReactNode;
  /** Optionale Aktion rechts (z. B. Button). */
  action?: ReactNode;
  className?: string;
};

const variantClasses: Record<CalloutVariant, { box: string; icon: string }> = {
  info: { box: "border-info/30 bg-info/10", icon: "text-info-fg" },
  success: { box: "border-success/30 bg-success/10", icon: "text-success-fg" },
  warning: { box: "border-warning/40 bg-warning/10", icon: "text-warning-fg" },
  danger: { box: "border-danger/30 bg-danger/10", icon: "text-danger-fg" },
};

const iconFor = {
  info: StatusIcons.info,
  success: StatusIcons.success,
  warning: StatusIcons.warning,
  danger: StatusIcons.error,
} as const;

/**
 * Hinweisbox für Infos, Warnungen und Fehler — ersetzt handgebaute
 * `bg-amber-50 border-amber-200 …`-Boxen, die im Dark-Mode grell blieben.
 */
export function Callout({
  variant = "info",
  title,
  children,
  action,
  className = "",
}: CalloutProps) {
  const cls = variantClasses[variant];
  const Icon = iconFor[variant];
  return (
    <div
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-lg border p-3 text-sm text-fg ${cls.box} ${className}`}
    >
      <Icon size={16} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${cls.icon}`} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-fg-muted">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
