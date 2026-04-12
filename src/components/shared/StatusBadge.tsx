type Status = 'green' | 'yellow' | 'red' | 'gray';

interface StatusBadgeProps {
  status: Status;
  label: string;
}

const statusStyles: Record<Status, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  gray: 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-400',
};

const dotStyles: Record<Status, string> = {
  green: 'bg-green-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  gray: 'bg-stone-400 dark:bg-stone-500',
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
