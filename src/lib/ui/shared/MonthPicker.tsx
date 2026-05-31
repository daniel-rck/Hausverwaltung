import { useId } from "react";

interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function MonthPicker({ value, onChange, label, className = "" }: MonthPickerProps) {
  const inputId = useId();
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
      />
    </div>
  );
}
