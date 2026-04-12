interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function MonthPicker({
  value,
  onChange,
  label,
  className = '',
}: MonthPickerProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-stone-500 mb-1">
          {label}
        </label>
      )}
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
      />
    </div>
  );
}
