type Status = 'green' | 'yellow' | 'red' | 'gray';

interface StatusBadgeProps {
  status: Status;
  label: string;
}

const statusStyles: Record<Status, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-stone-100 text-stone-600',
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'green'
            ? 'bg-green-500'
            : status === 'yellow'
              ? 'bg-amber-500'
              : status === 'red'
                ? 'bg-red-500'
                : 'bg-stone-400'
        }`}
      />
      {label}
    </span>
  );
}
