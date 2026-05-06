import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
  fullWidth?: boolean;
}

export const inputBaseClasses =
  'h-10 w-full rounded-lg border bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 ' +
  'placeholder:text-stone-400 dark:placeholder:text-stone-500 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:focus-visible:ring-stone-500 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

export const inputBorderClasses = 'border-stone-300 dark:border-stone-600';
export const inputInvalidClasses = 'border-red-500 dark:border-red-500 focus-visible:ring-red-400';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      invalid = false,
      leftAddon,
      rightAddon,
      fullWidth = true,
      className = '',
      type = 'text',
      ...rest
    },
    ref,
  ) => {
    const wrapperCls = [fullWidth ? 'w-full' : '', 'relative inline-flex items-center']
      .filter(Boolean)
      .join(' ');

    const padLeft = leftAddon ? 'pl-9' : 'pl-3';
    const padRight = rightAddon ? 'pr-9' : 'pr-3';

    const inputCls = [
      inputBaseClasses,
      invalid ? inputInvalidClasses : inputBorderClasses,
      padLeft,
      padRight,
      className,
    ].join(' ');

    if (!leftAddon && !rightAddon) {
      return <input ref={ref} type={type} aria-invalid={invalid || undefined} className={inputCls} {...rest} />;
    }

    return (
      <span className={wrapperCls}>
        {leftAddon && (
          <span
            className="absolute left-3 text-stone-400 dark:text-stone-500 text-sm pointer-events-none"
            aria-hidden="true"
          >
            {leftAddon}
          </span>
        )}
        <input ref={ref} type={type} aria-invalid={invalid || undefined} className={inputCls} {...rest} />
        {rightAddon && (
          <span
            className="absolute right-3 text-stone-400 dark:text-stone-500 text-sm pointer-events-none"
            aria-hidden="true"
          >
            {rightAddon}
          </span>
        )}
      </span>
    );
  },
);
Input.displayName = 'Input';
