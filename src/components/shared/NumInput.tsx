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
    // Deutsche Notation: "1.234,56" → "1234.56"
    // Punkt = Tausender-Trenner (entfernen), Komma = Dezimaltrenner (→ Punkt).
    // Wenn ausschließlich Punkte vorhanden sind und der letzte 1–3 Nachkommastellen
    // hat, behandeln wir ihn als Dezimaltrenner (englische Eingabe).
    let normalized = rawValue.trim();
    if (normalized.includes(',')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      const parts = normalized.split('.');
      if (parts.length > 1) {
        const last = parts[parts.length - 1];
        if (last.length === 3 && parts.slice(0, -1).every((p) => p.length === 3 || /^\d{1,3}$/.test(p))) {
          // "1.234" oder "1.234.567" — Tausender, kein Dezimal
          normalized = parts.join('');
        } else {
          normalized = parts.slice(0, -1).join('') + '.' + last;
        }
      }
    }
    const parsed = parseFloat(normalized);
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
        <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
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
          className="w-full border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm text-right font-mono bg-white dark:bg-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 disabled:bg-stone-50 disabled:text-stone-400 dark:disabled:bg-stone-800/50 dark:disabled:text-stone-500"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 dark:text-stone-500 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
