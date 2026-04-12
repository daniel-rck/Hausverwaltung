import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function Card({ title, children, className = '', action }: CardProps) {
  return (
    <div
      className={`bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 dark:border-stone-700">
          {title && (
            <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100">{title}</h2>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
