import type { ComponentProps } from "react";
import { cn, FOCUS_RING } from "./cn.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

// `not-disabled:hover:` rather than plain `hover:`, so a disabled button
// doesn't react to the pointer — and, unlike `enabled:`, it still applies when
// the classes style an <a> through buttonClassName().
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-600 text-fg-on-accent not-disabled:hover:bg-accent-700 focus-visible:outline-accent-500",
  secondary:
    "border border-border bg-surface-muted text-fg not-disabled:hover:bg-surface-sunken focus-visible:outline-accent-500",
  ghost:
    "bg-transparent text-fg not-disabled:hover:bg-surface-sunken focus-visible:outline-accent-500",
  danger:
    "bg-danger text-fg-on-accent not-disabled:hover:bg-danger-strong focus-visible:outline-danger",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

/** The button look for something that isn't a <button> — a router <Link>, say. */
export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    FOCUS_RING,
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export function Button({ variant, size, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClassName({ variant, size, className })} {...rest} />;
}
