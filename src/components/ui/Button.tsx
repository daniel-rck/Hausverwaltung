import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { moduleAccent, type ModulKey } from './moduleAccent';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  accent?: ModulKey;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

const baseClasses =
  'inline-flex items-center justify-center font-medium rounded-lg transition-colors select-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

function variantClasses(variant: Variant, accent?: ModulKey): string {
  const a = moduleAccent(accent);

  switch (variant) {
    case 'primary':
      if (a) {
        return `${a.buttonBg} text-white ${a.buttonHover} ${a.ring}`;
      }
      return 'bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 focus-visible:ring-stone-400';
    case 'secondary':
      return 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700 focus-visible:ring-stone-400';
    case 'ghost':
      return 'bg-transparent text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 focus-visible:ring-stone-400';
    case 'danger':
      return 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400';
    case 'link':
      return 'bg-transparent text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 underline-offset-4 hover:underline focus-visible:ring-stone-400 px-0 h-auto';
  }
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      accent,
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const cls = [
      baseClasses,
      variant === 'link' ? '' : sizeClasses[size],
      variantClasses(variant, accent),
      fullWidth ? 'w-full' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cls}
        {...rest}
      >
        {loading ? <Spinner /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);
Button.displayName = 'Button';

function Spinner() {
  return (
    <span
      className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
      aria-hidden="true"
    />
  );
}
