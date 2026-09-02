import type { ReactNode } from "react";
import { Check } from "./icons";
import type { ModulKey } from "./moduleAccent";

interface WizardStep {
  id: string;
  label: string;
  optional?: boolean;
}

interface WizardProps {
  steps: WizardStep[];
  current: number;
  /**
   * Modul-Akzent. Seit dem UI-Overhaul (Linear-Stil) nicht mehr ausgespielt —
   * Active-Step nutzt globalen Indigo-Akzent.
   */
  accent?: ModulKey;
  ariaLabel?: string;
}

export function Wizard({ steps, current, ariaLabel = "Fortschritt" }: WizardProps) {
  return (
    <nav aria-label={ariaLabel}>
      {/* Mobile: kompakt */}
      <div className="md:hidden">
        <div className="flex items-center justify-between text-xs text-fg-muted mb-2">
          <span>
            Schritt <span className="font-semibold text-fg">{current + 1}</span> von {steps.length}
          </span>
          <span className="text-fg font-medium">{steps[current]?.label}</span>
        </div>
        <div className="h-1 rounded-full bg-surface-sunken overflow-hidden">
          <div
            className="h-full bg-[--color-accent] transition-all"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Desktop: Stepper */}
      <ol className="hidden md:flex items-center gap-2">
        {steps.map((step, idx) => {
          const done = idx < current;
          const active = idx === current;
          return (
            <li key={step.id} className="flex items-center gap-2 flex-1">
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                  active
                    ? "bg-[--color-accent] text-fg-on-accent"
                    : done
                      ? "bg-surface-sunken text-fg"
                      : "bg-surface-sunken text-fg-muted"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : idx + 1}
              </span>
              <span className={`text-xs ${active ? "text-fg font-medium" : "text-fg-muted"}`}>
                {step.label}
                {step.optional && <span className="ml-1 text-fg-subtle">(optional)</span>}
              </span>
              {idx < steps.length - 1 && (
                <span aria-hidden="true" className="flex-1 h-px bg-surface-sunken" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface WizardFooterProps {
  onBack?: () => void;
  onNext?: () => void;
  onCancel?: () => void;
  nextLabel?: string;
  backLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  canBack?: boolean;
  canNext?: boolean;
}

export function WizardFooter({
  onBack,
  onNext,
  onCancel,
  nextLabel = "Weiter",
  backLabel = "Zurück",
  cancelLabel,
  busy = false,
  canBack = true,
  canNext = true,
}: WizardFooterProps): ReactNode {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-border">
      {cancelLabel && onCancel ? (
        <button type="button" onClick={onCancel} className="text-sm text-fg-muted hover:text-fg">
          {cancelLabel}
        </button>
      ) : (
        <span />
      )}
      <div className="flex gap-2 ml-auto">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={!canBack || busy}
            className="h-9 px-3.5 text-sm rounded-md border border-border text-fg hover:bg-surface-muted disabled:opacity-50 transition-colors"
          >
            {backLabel}
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext || busy}
            className="h-9 px-3.5 text-sm rounded-md bg-[--color-accent] text-fg-on-accent hover:bg-[--color-accent-hover] disabled:opacity-50 transition-colors"
          >
            {busy ? "…" : nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
