import { useCallback, useState } from "react";

export type Validator<TValues> = (value: unknown, values: TValues) => string | null | undefined;

export type ValidationSchema<TValues> = Partial<{
  [K in keyof TValues]: Validator<TValues>;
}>;

type Errors<TValues> = Partial<Record<keyof TValues, string>>;

interface UseFormValidationApi<TValues> {
  errors: Errors<TValues>;
  validate: (values: TValues) => boolean;
  validateField: (key: keyof TValues, values: TValues) => void;
  clear: () => void;
  setError: (key: keyof TValues, message: string | null) => void;
}

/**
 * Leichtgewichtige Validierung. Gib pro Feld eine Funktion an, die `null`
 * (oder undefined) zurückgibt, wenn alles OK ist — sonst die Fehlermeldung.
 */
export function useFormValidation<TValues extends Record<string, unknown>>(
  schema: ValidationSchema<TValues>,
): UseFormValidationApi<TValues> {
  const [errors, setErrors] = useState<Errors<TValues>>({});

  const validate = useCallback(
    (values: TValues): boolean => {
      const next: Errors<TValues> = {};
      for (const key of Object.keys(schema) as (keyof TValues)[]) {
        const fn = schema[key];
        if (!fn) continue;
        const msg = fn(values[key], values);
        if (msg) next[key] = msg;
      }
      setErrors(next);
      return Object.keys(next).length === 0;
    },
    [schema],
  );

  const validateField = useCallback(
    (key: keyof TValues, values: TValues) => {
      const fn = schema[key];
      if (!fn) return;
      const msg = fn(values[key], values);
      setErrors((prev) => {
        const copy = { ...prev };
        if (msg) copy[key] = msg;
        else delete copy[key];
        return copy;
      });
    },
    [schema],
  );

  const setError = useCallback((key: keyof TValues, message: string | null) => {
    setErrors((prev) => {
      const copy = { ...prev };
      if (message) copy[key] = message;
      else delete copy[key];
      return copy;
    });
  }, []);

  const clear = useCallback(() => setErrors({}), []);

  return { errors, validate, validateField, clear, setError };
}

/* Häufige Validatoren */
export const required =
  (message = "Pflichtfeld"): Validator<unknown> =>
  (value) =>
    value == null || (typeof value === "string" && value.trim() === "") ? message : null;

export const email =
  (message = "Ungültige E-Mail"): Validator<unknown> =>
  (value) => {
    if (typeof value !== "string" || value.trim() === "") return null;
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    return ok ? null : message;
  };

export const minLength =
  (n: number, message?: string): Validator<unknown> =>
  (value) => {
    if (typeof value !== "string") return null;
    return value.trim().length >= n ? null : (message ?? `Mindestens ${n} Zeichen`);
  };

export const min =
  (n: number, message?: string): Validator<unknown> =>
  (value) => {
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(num)) return null;
    return num >= n ? null : (message ?? `Mindestens ${n}`);
  };
