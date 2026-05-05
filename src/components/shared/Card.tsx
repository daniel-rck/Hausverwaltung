import type { ReactNode } from 'react';
import { moduleAccent, type ModulKey } from '../ui/moduleAccent';

type Padding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  footer?: ReactNode;
  accent?: ModulKey;
  padding?: Padding;
  interactive?: boolean;
  as?: 'div' | 'section' | 'article';
}

const padMap: Record<Padding, string> = {
  none: '',
  sm: 'px-3 py-3',
  md: 'px-5 py-4',
  lg: 'px-6 py-5',
};

export function Card({
  title,
  description,
  children,
  className = '',
  action,
  footer,
  accent,
  padding = 'md',
  interactive = false,
  as: Tag = 'section',
}: CardProps) {
  const a = moduleAccent(accent);
  const accentBar = a ? (
    <span aria-hidden="true" className={`absolute left-0 top-0 bottom-0 w-1 ${a.bg} rounded-l-xl`} />
  ) : null;

  const interactiveCls = interactive
    ? 'transition-all hover:shadow-md hover:-translate-y-px cursor-pointer'
    : '';

  return (
    <Tag
      className={`relative bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm ${interactiveCls} ${className}`}
    >
      {accentBar}
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 py-3 border-b border-stone-100 dark:border-stone-700">
          <div className="min-w-0">
            {title &&
              (typeof title === 'string' ? (
                <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100 truncate">
                  {title}
                </h2>
              ) : (
                title
              ))}
            {description && (
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={padMap[padding]}>{children}</div>
      {footer && (
        <footer className="px-5 py-3 border-t border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/30 rounded-b-xl">
          {footer}
        </footer>
      )}
    </Tag>
  );
}
