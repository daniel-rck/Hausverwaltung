interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rect';
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({
  variant = 'rect',
  width,
  height,
  className = '',
}: SkeletonProps) {
  const base = 'bg-stone-200 dark:bg-stone-700 animate-pulse';
  const shape =
    variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded h-4' : 'rounded-lg';
  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label="Lädt"
      className={`block ${base} ${shape} ${className}`}
      style={style}
    />
  );
}
