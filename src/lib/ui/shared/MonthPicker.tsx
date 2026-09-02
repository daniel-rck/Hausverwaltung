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
        <label htmlFor={inputId} className="block text-xs font-medium text-fg-muted mb-1">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-accent-500"
      />
    </div>
  );
}
