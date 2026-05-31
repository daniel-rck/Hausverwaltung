import { forwardRef, type TextareaHTMLAttributes } from "react";
import { inputBorderClasses, inputInvalidClasses } from "./Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const textareaBase =
  "w-full rounded-md border bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-100 " +
  "placeholder:text-zinc-400 dark:placeholder:text-zinc-500 px-3 py-2 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]/40 focus-visible:border-[--color-accent] " +
  "disabled:opacity-60 disabled:cursor-not-allowed resize-y min-h-[80px] transition-colors";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid = false, className = "", rows = 3, ...rest }, ref) => {
    const cls = [textareaBase, invalid ? inputInvalidClasses : inputBorderClasses, className].join(
      " ",
    );
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={cls}
        {...rest}
      />
    );
  },
);
Textarea.displayName = "Textarea";
