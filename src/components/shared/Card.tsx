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
      className={`bg-white rounded-xl border border-stone-200 shadow-sm ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
          {title && (
            <h2 className="text-base font-semibold text-stone-800">{title}</h2>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
