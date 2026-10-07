import type { ReactNode } from "react";

interface PrintLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function PrintLayout({ title, subtitle, children }: PrintLayoutProps) {
  // oxlint-disable-next-line react/purity -- the print footer shows the date the page is rendered/printed
  const printedOn = new Date().toLocaleDateString("de-DE");
  return (
    <div className="print-container">
      <div className="print-only mb-6">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
        <hr className="mt-2" />
      </div>
      {children}
      <div className="print-only mt-8 text-xs text-fg-subtle">
        Erstellt am {printedOn} | Hausverwaltung
      </div>
    </div>
  );
}
