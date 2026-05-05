import type { ReactNode } from 'react';
import { moduleAccent, type ModulKey } from './moduleAccent';

interface WizardStep {
  id: string;
  label: string;
  optional?: boolean;
}

interface WizardProps {
  steps: WizardStep[];
  current: number;
  accent?: ModulKey;
  ariaLabel?: string;
}

export function Wizard({ steps, current, accent, ariaLabel = 'Fortschritt' }: WizardProps) {
  const a = moduleAccent(accent);
  const activeBg = a?.bg ?? 'bg-stone-800 dark:bg-stone-100';
  const activeText = a?.text ?? 'text-stone-900 dark:text-stone-100';

  return (
    <nav aria-label={ariaLabel}>
      {/* Mobile: kompakt */}
      <div className="md:hidden">
        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-2">
          <span>
            Schritt <span className={`font-semibold ${activeText}`}>{current + 1}</span> von {steps.length}
          </span>
          <span className={activeText}>{steps[current]?.label}</span>
        </div>
        <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
          <div
            className={`h-full ${activeBg} transition-all`}
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
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                  active
                    ? `${activeBg} text-white`
                    : done
                      ? 'bg-stone-300 dark:bg-stone-600 text-stone-700 dark:text-stone-200'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                {done ? '✓' : idx + 1}
              </span>
              <span
                className={`text-xs ${active ? activeText + ' font-medium' : 'text-stone-500 dark:text-stone-400'}`}
              >
                {step.label}
                {step.optional && <span className="ml-1 text-stone-400">(optional)</span>}
              </span>
              {idx < steps.length - 1 && (
                <span aria-hidden="true" className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
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
    <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-stone-200 dark:border-stone-700">
      {cancelLabel && onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
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
            className="h-10 px-4 text-sm rounded-lg border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 disabled:opacity-50"
          >
            {backLabel}
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext || busy}
            className="h-10 px-4 text-sm rounded-lg bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 disabled:opacity-50"
          >
            {busy ? '…' : nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
