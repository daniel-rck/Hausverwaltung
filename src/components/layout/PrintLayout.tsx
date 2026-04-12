import type { ReactNode } from 'react';

interface PrintLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function PrintLayout({ title, subtitle, children }: PrintLayoutProps) {
  return (
    <div className="print-container">
      <div className="print-only mb-6">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
        <hr className="mt-2" />
      </div>
      {children}
      <div className="print-only mt-8 text-xs text-stone-400">
        Erstellt am {new Date().toLocaleDateString('de-DE')} | Hausverwaltung
      </div>
    </div>
  );
}
