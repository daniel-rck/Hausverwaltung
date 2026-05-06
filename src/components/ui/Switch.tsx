import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, className = '', id, checked, disabled, ...rest }, ref) => {
    const reactId = useId();
    const inputId = id ?? reactId;

    return (
      <label
        htmlFor={inputId}
        className={`inline-flex items-start gap-3 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="relative inline-block w-9 h-5 mt-0.5 shrink-0">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            className={`peer sr-only ${className}`}
            {...rest}
          />
          <span className="absolute inset-0 rounded-full bg-stone-300 dark:bg-stone-600 peer-checked:bg-stone-800 dark:peer-checked:bg-stone-200 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-stone-400 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-stone-900" />
          <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
        </span>
        {(label || description) && (
          <span className="text-sm">
            {label && <span className="text-stone-700 dark:text-stone-200">{label}</span>}
            {description && (
              <span className="block text-xs text-stone-500 dark:text-stone-400 mt-0.5">{description}</span>
            )}
          </span>
        )}
      </label>
    );
  },
);
Switch.displayName = 'Switch';
