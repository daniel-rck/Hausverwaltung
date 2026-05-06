import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'ghost' | 'subtle' | 'solid';
type Size = 'sm' | 'md';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Pflicht: aria-label für Screenreader. */
  'aria-label': string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const sizeClasses: Record<Size, string> = {
  sm: 'w-8 h-8 text-base',
  md: 'w-10 h-10 text-lg',
};

const variantClasses: Record<Variant, string> = {
  ghost:
    'bg-transparent text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800',
  subtle:
    'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700',
  solid:
    'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      icon,
      children,
      className = '',
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const cls = [
      'inline-flex items-center justify-center rounded-lg transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      sizeClasses[size],
      variantClasses[variant],
      className,
    ].join(' ');

    return (
      <button ref={ref} type={type} className={cls} {...rest}>
        <span aria-hidden="true">{icon ?? children}</span>
      </button>
    );
  },
);
IconButton.displayName = 'IconButton';
