import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { inputBorderClasses, inputInvalidClasses } from './Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const textareaBase =
  'w-full rounded-lg border bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 ' +
  'placeholder:text-stone-400 dark:placeholder:text-stone-500 px-3 py-2 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:focus-visible:ring-stone-500 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed resize-y min-h-[80px]';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid = false, className = '', rows = 3, ...rest }, ref) => {
    const cls = [
      textareaBase,
      invalid ? inputInvalidClasses : inputBorderClasses,
      className,
    ].join(' ');
    return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cls} {...rest} />;
  },
);
Textarea.displayName = 'Textarea';
