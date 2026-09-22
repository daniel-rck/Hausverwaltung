type Status = "green" | "yellow" | "red" | "gray";

interface StatusBadgeProps {
  status: Status;
  label: string;
}

const statusStyles: Record<Status, string> = {
  green: "bg-success/10 text-success-fg",
  yellow: "bg-warning/10 text-warning-fg",
  red: "bg-danger/10 text-danger-fg",
  gray: "bg-surface-sunken text-fg-muted",
};

const dotStyles: Record<Status, string> = {
  green: "bg-success",
  yellow: "bg-warning",
  red: "bg-danger",
  gray: "bg-fg-subtle",
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[status]}`} />
      {label}
    </span>
  );
}
