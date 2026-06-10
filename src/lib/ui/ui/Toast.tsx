/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StatusIcons, X } from "./icons";

type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastInput {
  message: ReactNode;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends Required<Pick<ToastInput, "message">> {
  id: number;
  variant: ToastVariant;
  duration: number;
  action?: ToastInput["action"];
}

interface ToastApi {
  show: (input: ToastInput) => void;
  success: (message: ReactNode, options?: Partial<Omit<ToastInput, "message" | "variant">>) => void;
  error: (message: ReactNode, options?: Partial<Omit<ToastInput, "message" | "variant">>) => void;
  info: (message: ReactNode, options?: Partial<Omit<ToastInput, "message" | "variant">>) => void;
  warning: (message: ReactNode, options?: Partial<Omit<ToastInput, "message" | "variant">>) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast muss innerhalb von <ToastProvider> aufgerufen werden.");
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

  const show = useCallback((input: ToastInput) => {
    const id = ++idRef.current;
    const item: ToastItem = {
      id,
      message: input.message,
      variant: input.variant ?? "info",
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
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => {
        clearTimeout(t);
      });
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, options) => show({ message, ...options, variant: "success" }),
      error: (message, options) =>
        show({ message, ...options, variant: "error", duration: options?.duration ?? 6000 }),
      info: (message, options) => show({ message, ...options, variant: "info" }),
      warning: (message, options) => show({ message, ...options, variant: "warning" }),
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

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
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
  success: "border-green-200/60 dark:border-green-900/60 bg-surface text-fg",
  error: "border-red-200/60 dark:border-red-900/60 bg-surface text-fg",
  info: "border-border bg-surface text-fg",
  warning: "border-amber-200/60 dark:border-amber-900/60 bg-surface text-fg",
};

const variantIconColor: Record<ToastVariant, string> = {
  success: "text-green-600 dark:text-green-400",
  error: "text-red-600 dark:text-red-400",
  info: "text-[--color-accent] dark:text-[--color-accent-dark]",
  warning: "text-amber-600 dark:text-amber-400",
};

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const role = item.variant === "error" ? "alert" : "status";
  const Icon = StatusIcons[item.variant];
  return (
    <div
      role={role}
      className={`pointer-events-auto w-full max-w-sm rounded-lg border shadow-pop px-3.5 py-2.5 flex items-start gap-3 text-sm ${variantClasses[item.variant]}`}
    >
      <Icon
        size={16}
        strokeWidth={2}
        className={`mt-0.5 shrink-0 ${variantIconColor[item.variant]}`}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p>{item.message}</p>
        {item.action && (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              onDismiss(item.id);
            }}
            className="text-xs font-medium text-[--color-accent] dark:text-[--color-accent-dark] hover:underline mt-1"
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Schließen"
        className="text-zinc-400 hover:text-fg -mr-1 -mt-0.5 p-1 rounded-md hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]/40"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
