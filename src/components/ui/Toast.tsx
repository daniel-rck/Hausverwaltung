/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastInput {
  message: ReactNode;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends Required<Pick<ToastInput, 'message'>> {
  id: number;
  variant: ToastVariant;
  duration: number;
  action?: ToastInput['action'];
}

interface ToastApi {
  show: (input: ToastInput) => void;
  success: (message: ReactNode, options?: Partial<Omit<ToastInput, 'message' | 'variant'>>) => void;
  error: (message: ReactNode, options?: Partial<Omit<ToastInput, 'message' | 'variant'>>) => void;
  info: (message: ReactNode, options?: Partial<Omit<ToastInput, 'message' | 'variant'>>) => void;
  warning: (message: ReactNode, options?: Partial<Omit<ToastInput, 'message' | 'variant'>>) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast muss innerhalb von <ToastProvider> aufgerufen werden.');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current;
      const item: ToastItem = {
        id,
        message: input.message,
        variant: input.variant ?? 'info',
        duration: input.duration ?? 4000,
        action: input.action,
      };
      setItems((prev) => [...prev, item]);
      if (item.duration > 0) {
        const timer = setTimeout(() => {
          timersRef.current.delete(id);
          setItems((prev) => prev.filter((t) => t.id !== id));
        }, item.duration);
        timersRef.current.set(id, timer);
      }
    },
    [],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, options) => show({ message, ...options, variant: 'success' }),
      error: (message, options) => show({ message, ...options, variant: 'error', duration: options?.duration ?? 6000 }),
      info: (message, options) => show({ message, ...options, variant: 'info' }),
      warning: (message, options) => show({ message, ...options, variant: 'warning' }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed z-[100] pointer-events-none flex flex-col gap-2 px-4
                 bottom-20 md:bottom-auto md:top-4 md:right-4 md:left-auto
                 left-0 right-0 md:px-0 md:items-end items-center"
    >
      {items.map((t) => (
        <ToastView key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const variantClasses: Record<ToastVariant, string> = {
  success:
    'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/80 text-green-800 dark:text-green-200',
  error:
    'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/80 text-red-800 dark:text-red-200',
  info:
    'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100',
  warning:
    'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200',
};

const variantIcon: Record<ToastVariant, string> = {
  success: '✓',
  error: '⚠',
  info: 'ℹ',
  warning: '⚠',
};

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const role = item.variant === 'error' ? 'alert' : 'status';
  return (
    <div
      role={role}
      className={`pointer-events-auto w-full max-w-sm rounded-lg border shadow-lg px-4 py-3 flex items-start gap-3 text-sm ${variantClasses[item.variant]}`}
    >
      <span aria-hidden="true" className="text-base leading-5">
        {variantIcon[item.variant]}
      </span>
      <div className="flex-1 min-w-0">
        <p>{item.message}</p>
        {item.action && (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              onDismiss(item.id);
            }}
            className="text-xs font-medium underline mt-1"
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Schließen"
        className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
