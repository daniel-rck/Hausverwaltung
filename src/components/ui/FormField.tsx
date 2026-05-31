import { cloneElement, isValidElement, type ReactElement, type ReactNode, useId } from "react";

interface FormFieldProps {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}

/**
 * Wickelt ein Form-Element. Sorgt für konsistente Label-Typo, Pflichtfeld-Marker,
 * automatische aria-describedby/aria-invalid-Verkabelung an einem direkt enthaltenen
 * <Input>/<Select>/<Textarea>.
 */
export function FormField({
  label,
  description,
  error,
  hint,
  required = false,
  htmlFor,
  children,
}: FormFieldProps) {
  const reactId = useId();
  const fieldId = htmlFor ?? reactId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const descId = description ? `${fieldId}-desc` : undefined;
  const describedBy = [descId, errorId].filter(Boolean).join(" ") || undefined;

  let enhanced: ReactNode = children;
  if (isValidElement(children)) {
    const el = children as ReactElement<Record<string, unknown>>;
    enhanced = cloneElement(el, {
      id: (el.props.id as string | undefined) ?? fieldId,
      "aria-describedby": describedBy ?? (el.props["aria-describedby"] as string | undefined),
      "aria-invalid": error ? true : (el.props["aria-invalid"] as boolean | undefined),
      "aria-required": required || (el.props["aria-required"] as boolean | undefined),
      invalid: error ? true : (el.props.invalid as boolean | undefined),
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={fieldId} className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {label}
          {required && (
            <span className="text-red-600 dark:text-red-400 ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {description && (
        <p id={descId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      )}
      {enhanced}
      <div className="min-h-[1rem] flex items-start justify-between gap-2">
        {error ? (
          <p id={errorId} className="text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : (
          <span aria-hidden="true" />
        )}
        {hint && !error && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 ml-auto">{hint}</p>
        )}
      </div>
    </div>
  );
}
