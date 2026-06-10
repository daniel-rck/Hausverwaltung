import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = "", id, ...rest }, ref) => {
    const reactId = useId();
    const inputId = id ?? (label ? reactId : undefined);

    const input = (
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={[
          "h-4 w-4 rounded border-border",
          "text-fg",
          "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        ].join(" ")}
        {...rest}
      />
    );

    if (!label && !description) return input;

    return (
      <label htmlFor={inputId} className="flex items-start gap-2 cursor-pointer select-none">
        <span className="mt-0.5">{input}</span>
        <span className="text-sm">
          {label && <span className="text-fg">{label}</span>}
          {description && <span className="block text-xs text-fg-muted mt-0.5">{description}</span>}
        </span>
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
