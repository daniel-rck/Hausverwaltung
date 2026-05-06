import type { ReactNode } from 'react';
import { moduleAccent, type ModulKey } from './moduleAccent';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  accent?: ModulKey;
  className?: string;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200',
  success: 'bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-200',
  warning: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200',
  danger: 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-200',
  info: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
};

export function Badge({
  variant = 'neutral',
  size = 'md',
  accent,
  className = '',
  children,
}: BadgeProps) {
  const a = moduleAccent(accent);
  const accentCls = a ? `${a.pillBg} ${a.pillText}` : variantClasses[variant];
  const cls = [
    'inline-flex items-center gap-1 rounded-full font-medium',
    sizeClasses[size],
    accentCls,
    className,
  ].join(' ');
  return <span className={cls}>{children}</span>;
}
