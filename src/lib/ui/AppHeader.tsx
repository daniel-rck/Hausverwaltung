import type { ReactNode } from "react";

export type AppHeaderProps = {
  title: string;
  logo?: ReactNode;
  actions?: ReactNode;
  /**
   * Width of the header's inner container, as a Tailwind max-w-* class. Defaults
   * to `max-w-4xl` to line up with AppShell's content column; an app whose
   * layout is wider (a grid of cards, a data table) passes its own so the header
   * doesn't sit narrower than the page under it.
   */
  maxWidthClass?: string;
};

export function AppHeader({ title, logo, actions, maxWidthClass = "max-w-4xl" }: AppHeaderProps) {
  return (
    <header
      // The height lives on the inner container, not here: on a notched phone
      // the header also has to absorb the status-bar inset, and a fixed h-14 on
      // the <header> would push the title up under the notch instead.
      className="sticky top-0 z-20 shrink-0 border-b border-border bg-surface/95 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div
        className={`container mx-auto ${maxWidthClass} h-14 px-4 flex items-center justify-between gap-4`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {logo ? <span className="text-accent-600 shrink-0">{logo}</span> : null}
          {/* Branding, not a heading: the page's <h1> is its PageHeader, so the
              outline doesn't open with the same app name on every page. */}
          <span className="text-base font-semibold tracking-tight truncate">{title}</span>
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
