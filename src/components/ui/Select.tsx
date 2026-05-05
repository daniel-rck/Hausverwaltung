import { forwardRef, type SelectHTMLAttributes } from 'react';
import { inputBaseClasses, inputBorderClasses, inputInvalidClasses } from './Input';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ invalid = false, className = '', children, ...rest }, ref) => {
    const cls = [
      inputBaseClasses,
      invalid ? inputInvalidClasses : inputBorderClasses,
      'pl-3 pr-8 appearance-none bg-no-repeat',
      "bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'><path stroke='%23737373' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/></svg>\")]",
      'bg-[length:18px_18px] bg-[right_0.5rem_center]',
      className,
    ].join(' ');

    return (
      <select ref={ref} aria-invalid={invalid || undefined} className={cls} {...rest}>
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';
