import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = '', id, ...rest }, ref) => {
    const inputId = id ?? (label ? `cb-${Math.random().toString(36).slice(2, 8)}` : undefined);

    const input = (
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={[
          'h-4 w-4 rounded border-stone-300 dark:border-stone-600',
          'text-stone-900 dark:text-stone-100',
          'focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        ].join(' ')}
        {...rest}
      />
    );

    if (!label && !description) return input;

    return (
      <label htmlFor={inputId} className="flex items-start gap-2 cursor-pointer select-none">
        <span className="mt-0.5">{input}</span>
        <span className="text-sm">
          {label && <span className="text-stone-700 dark:text-stone-200">{label}</span>}
          {description && (
            <span className="block text-xs text-stone-500 dark:text-stone-400 mt-0.5">{description}</span>
          )}
        </span>
      </label>
    );
  },
);
Checkbox.displayName = 'Checkbox';
