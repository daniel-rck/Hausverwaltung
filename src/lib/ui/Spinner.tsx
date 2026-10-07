import { cn } from "./cn.ts";

export type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
};

const SIZE = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-10 w-10" } as const;

/**
 * A status region with real (visually hidden) text: screen readers announce
 * `role="status"` content, not an `aria-label` on it. The reduced-motion reset
 * spares `.animate-spin` — this is a progress signal, not decoration.
 */
export function Spinner({ size = "md", className, label = "Lädt …" }: SpinnerProps) {
  return (
    <span role="status" className={cn("inline-flex text-accent-600", className)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={cn("animate-spin", SIZE[size])}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path
          d="M22 12a10 10 0 0 0-10-10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
