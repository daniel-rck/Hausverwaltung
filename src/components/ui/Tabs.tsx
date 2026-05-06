import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { moduleAccent, type ModulKey } from './moduleAccent';

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Optional: ID des zugehörigen Panels für `aria-controls`. */
  panelId?: string;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  accent?: ModulKey;
  ariaLabel?: string;
  fullWidth?: boolean;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  accent,
  ariaLabel,
  fullWidth = false,
}: TabsProps<T>) {
  const baseId = useId();
  const a = moduleAccent(accent);
  const activeText = a?.text ?? 'text-stone-900 dark:text-stone-100';
  const activeBar = a?.bg ?? 'bg-stone-900 dark:bg-stone-100';

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const enabledIndices = items
    .map((item, idx) => ({ idx, disabled: !!item.disabled }))
    .filter((x) => !x.disabled)
    .map((x) => x.idx);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
    if (enabledIndices.length === 0) return;
    let target: number | null = null;
    const pos = enabledIndices.indexOf(currentIdx);

    switch (e.key) {
      case 'ArrowRight':
        target = enabledIndices[(pos + 1) % enabledIndices.length];
        break;
      case 'ArrowLeft':
        target = enabledIndices[(pos - 1 + enabledIndices.length) % enabledIndices.length];
        break;
      case 'Home':
        target = enabledIndices[0];
        break;
      case 'End':
        target = enabledIndices[enabledIndices.length - 1];
        break;
      default:
        return;
    }
    e.preventDefault();
    const item = items[target];
    if (!item) return;
    onChange(item.id);
    tabRefs.current[target]?.focus();
  };

  return (
    <div role="tablist" aria-label={ariaLabel} className="border-b border-stone-200 dark:border-stone-700">
      <div className={`flex gap-1 ${fullWidth ? 'w-full' : ''} overflow-x-auto`}>
        {items.map((item, idx) => {
          const active = item.id === value;
          const tabId = `${baseId}-${item.id}`;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              role="tab"
              id={tabId}
              type="button"
              aria-selected={active}
              aria-controls={item.panelId}
              tabIndex={active ? 0 : -1}
              disabled={item.disabled}
              onClick={() => !item.disabled && onChange(item.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={[
                'relative inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                fullWidth ? 'flex-1 justify-center' : '',
                active
                  ? activeText
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200',
              ].join(' ')}
            >
              {item.icon && (
                <span aria-hidden="true" className="text-base">
                  {item.icon}
                </span>
              )}
              {item.label}
              <span
                aria-hidden="true"
                className={`absolute left-2 right-2 -bottom-px h-0.5 rounded-full transition-opacity ${activeBar} ${active ? 'opacity-100' : 'opacity-0'}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
