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
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {description && <p className="text-xs text-fg-muted">{description}</p>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
