import { useCallback, useId, useRef, useState } from "react";
import { formatNumberForInput, parseGermanNumber } from "../../utils/format";

type NumInputProps = {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  suffix?: string;
  min?: number;
  max?: number;
  /** Nachkommastellen im Anzeige-Zustand (Default 2). */
  decimals?: number;
  className?: string;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

/**
 * Zahleneingabe mit deutscher Formatierung.
 * Zeigt "1.234,56" im Blur-Zustand, erlaubt freie Eingabe im Focus-Zustand.
 * `onChange` feuert nur, wenn der Nutzer den Text tatsächlich geändert hat —
 * bloßes Durchtabben verändert keinen Wert.
 */
export function NumInput({
  value,
  onChange,
  label,
  suffix,
  min,
  max,
  decimals = 2,
  className = "",
  disabled = false,
  id,
  invalid = false,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: NumInputProps) {
  const [editing, setEditing] = useState(false);
  const [rawValue, setRawValue] = useState("");
  const initialRaw = useRef("");
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const formatted = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, 4),
  }).format(value);

  const handleFocus = useCallback(() => {
    const raw = value === 0 ? "" : formatNumberForInput(value);
    initialRaw.current = raw;
    setRawValue(raw);
    setEditing(true);
  }, [value]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (rawValue === initialRaw.current) return;
    const parsed = rawValue.trim() === "" ? 0 : parseGermanNumber(rawValue);
    if (parsed === null) return;
    let clamped = parsed;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    if (clamped !== value) onChange(clamped);
  }, [rawValue, min, max, value, onChange]);

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-fg-muted mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={editing ? rawValue : formatted}
          onChange={(e) => setRawValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // Erst den Wert übernehmen, dann (in einem Formular) absenden —
            // sonst sähe der Submit-Handler noch den alten Wert.
            e.preventDefault();
            const form = e.currentTarget.form;
            e.currentTarget.blur();
            if (form) setTimeout(() => form.requestSubmit(), 0);
          }}
          disabled={disabled}
          aria-label={label ? undefined : ariaLabel}
          aria-invalid={invalid || undefined}
          aria-describedby={ariaDescribedBy}
          className={`w-full border rounded-lg px-3 py-1.5 text-sm text-right font-mono bg-surface text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:bg-surface-sunken disabled:text-fg-subtle ${
            invalid ? "border-danger" : "border-border"
          } ${suffix ? "pr-10" : ""}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-subtle pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
