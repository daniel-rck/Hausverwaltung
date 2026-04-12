import { useRef, useState, useCallback } from 'react';

interface NumInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Zahleneingabe mit deutscher Formatierung.
 * Zeigt "1.234,56" im Blur-Zustand, erlaubt freie Eingabe im Focus-Zustand.
 */
export function NumInput({
  value,
  onChange,
  label,
  suffix,
  min,
  max,
  step = 0.01,
  className = '',
  disabled = false,
}: NumInputProps) {
  const [editing, setEditing] = useState(false);
  const [rawValue, setRawValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const formatted = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  const handleFocus = useCallback(() => {
    setEditing(true);
    setRawValue(value === 0 ? '' : String(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    const parsed = parseFloat(rawValue.replace(',', '.'));
    if (!isNaN(parsed)) {
      let clamped = parsed;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      onChange(clamped);
    }
  }, [rawValue, min, max, onChange]);

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-stone-500 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type={editing ? 'text' : 'text'}
          inputMode="decimal"
          value={editing ? rawValue : formatted}
          onChange={(e) => setRawValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          step={step}
          disabled={disabled}
          className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
