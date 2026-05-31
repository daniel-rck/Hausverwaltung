import type { ReactNode } from "react";

interface FormSectionProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="space-y-3">
      <header className="space-y-0.5">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h3>
        {description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
