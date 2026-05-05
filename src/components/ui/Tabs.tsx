import { useId, type ReactNode } from 'react';
import { moduleAccent, type ModulKey } from './moduleAccent';

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
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

  return (
    <div role="tablist" aria-label={ariaLabel} className="border-b border-stone-200 dark:border-stone-700">
      <div className={`flex gap-1 ${fullWidth ? 'w-full' : ''} overflow-x-auto`}>
        {items.map((item) => {
          const active = item.id === value;
          const tabId = `${baseId}-${item.id}`;
          return (
            <button
              key={item.id}
              role="tab"
              id={tabId}
              type="button"
              aria-selected={active}
              aria-controls={`${tabId}-panel`}
              tabIndex={active ? 0 : -1}
              disabled={item.disabled}
              onClick={() => !item.disabled && onChange(item.id)}
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
