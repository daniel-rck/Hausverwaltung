import type { ReactNode } from 'react';
import type { ModulKey } from './moduleAccent';
import { Check } from './icons';

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

export function Wizard({ steps, current, ariaLabel = 'Fortschritt' }: WizardProps) {
  return (
    <nav aria-label={ariaLabel}>
      {/* Mobile: kompakt */}
      <div className="md:hidden">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-2">
          <span>
            Schritt <span className="font-semibold text-zinc-900 dark:text-zinc-50">{current + 1}</span> von {steps.length}
          </span>
          <span className="text-zinc-900 dark:text-zinc-50 font-medium">{steps[current]?.label}</span>
        </div>
        <div className="h-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
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
                    ? 'bg-[--color-accent] text-white'
                    : done
                      ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : idx + 1}
              </span>
              <span
                className={`text-xs ${active ? 'text-zinc-900 dark:text-zinc-50 font-medium' : 'text-zinc-500 dark:text-zinc-400'}`}
              >
                {step.label}
                {step.optional && <span className="ml-1 text-zinc-400">(optional)</span>}
              </span>
              {idx < steps.length - 1 && (
                <span aria-hidden="true" className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
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
  nextLabel = 'Weiter',
  backLabel = 'Zurück',
  cancelLabel,
  busy = false,
  canBack = true,
  canNext = true,
}: WizardFooterProps): ReactNode {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
      {cancelLabel && onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
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
            className="h-9 px-3.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            {backLabel}
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext || busy}
            className="h-9 px-3.5 text-sm rounded-md bg-[--color-accent] text-white hover:bg-[--color-accent-hover] disabled:opacity-50 transition-colors"
          >
            {busy ? '…' : nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
